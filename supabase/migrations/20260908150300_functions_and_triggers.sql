-- Kütahya Taksi Ağı — fonksiyonlar ve trigger'lar
--
-- Tum fonksiyonlar `set search_path = ''` ile yazilir ve nesneler tam nitelenir;
-- bu, search_path manipulasyonuyla yapilan yetki yukseltme saldirilarina karsi
-- Supabase'in onerdigi uygulamadir.

-- ---------------------------------------------------------------------------
-- is_admin() — yetki kontrolu
--
-- RLS policy'si icinde dogrudan `profiles`'a select yapmak sonsuz ozyineleme
-- uretir (profiles'in kendi policy'si yine profiles'i sorgular). SECURITY DEFINER
-- fonksiyon bu dongusu kirar.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'Mevcut kullanici admin mi? RLS ozyinelemesini kirmak icin SECURITY DEFINER.';

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- updated_at otomatik guncelleme
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger locations_set_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

create trigger landing_pages_set_updated_at
  before update on public.landing_pages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Yeni auth kullanicisi icin otomatik profil
--
-- Profil olmadan kullanici hicbir sey yapamaz; bunu uygulama katmanina birakmak
-- yarim kalmis kayitlar uretirdi.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- profiles.role korumasi
--
-- Kullanici kendi rolunu 'admin' yapabilseydi tum RLS modeli coker. RLS policy'si
-- satiri yazmaya izin verir; hangi KOLONUN degistigini burada denetliyoruz.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Kullanici kendi rolunu degistiremez.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------------
-- businesses: sahibin degistiremeyecegi kolonlar
--
-- Isletme sahibi kendi kaydini guncelleyebilir ama kendini 'active' yapamaz,
-- 'verified' rozeti veremez, plani 'premium'a cekemez, sahipligi devredemez.
-- Bunlar admin kararidir. RLS satir seviyesinde izin verdigi icin kolon seviyesi
-- korumasi burada yapilir.
-- ---------------------------------------------------------------------------
create or replace function public.protect_business_admin_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.status is distinct from old.status
     or new.verification_status is distinct from old.verification_status
     or new.plan is distinct from old.plan
     or new.owner_id is distinct from old.owner_id
     or new.source_type is distinct from old.source_type
     or new.last_verified_at is distinct from old.last_verified_at
     or new.verified_by is distinct from old.verified_by
     or new.claimed_at is distinct from old.claimed_at
     or new.category_id is distinct from old.category_id
  then
    raise exception 'Bu alanlar yalnizca yonetici tarafindan degistirilebilir.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger businesses_protect_admin_columns
  before update on public.businesses
  for each row execute function public.protect_business_admin_columns();

-- ---------------------------------------------------------------------------
-- Slug degisiminde eski slug'i sakla (§64)
--
-- Slug degisince eski URL'ler olur. 301 verebilmek icin gecmisi tutuyoruz.
-- ---------------------------------------------------------------------------
create or replace function public.record_business_slug_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug then
    -- Yeni slug daha once baska bir kaydin eski slug'iysa, o kayit artik gecerli
    -- hedef degildir; catismayi onlemek icin eski girdiyi temizliyoruz.
    delete from public.business_slug_history where old_slug = new.slug;

    insert into public.business_slug_history (business_id, old_slug)
    values (old.id, old.slug)
    on conflict (old_slug) do update set business_id = excluded.business_id;
  end if;
  return new;
end;
$$;

create trigger businesses_record_slug_change
  after update of slug on public.businesses
  for each row execute function public.record_business_slug_change();

-- ---------------------------------------------------------------------------
-- Turkiye telefon numarasi normalizasyonu (§53)
--
-- Kabul edilen girdiler: 05551112233, 5551112233, +905551112233, 0090..., ve
-- bosluk/parantez/tire iceren varyantlar. Cikti daima E.164.
-- Tanimadigi bicimde NULL doner — yanlis numara uretmektense bos birakmak dogrudur.
-- ---------------------------------------------------------------------------
create or replace function public.normalize_tr_phone(value text)
returns text
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  digits text;
begin
  if value is null then
    return null;
  end if;

  digits := regexp_replace(value, '[^0-9]', '', 'g');

  -- 0090 555 111 22 33 -> 905551112233
  if digits like '00%' then
    digits := substring(digits from 3);
  end if;

  -- 90 555 111 22 33
  if length(digits) = 12 and digits like '90%' then
    return '+' || digits;
  end if;

  -- 0 555 111 22 33  /  0 274 ... (sabit hat)
  if length(digits) = 11 and digits like '0%' then
    return '+90' || substring(digits from 2);
  end if;

  -- 555 111 22 33 (bas sifirsiz)
  if length(digits) = 10 and substring(digits from 1 for 1) <> '0' then
    return '+90' || digits;
  end if;

  -- Taninmayan bicim: uydurma numara uretme, bos birak.
  return null;
end;
$$;

comment on function public.normalize_tr_phone(text) is
  'Turkiye telefon bicimlerini E.164''e cevirir. Taninmayan bicimde NULL doner — '
  'yanlis numara uretmektense bos birakmak dogrudur.';

-- ---------------------------------------------------------------------------
-- Gunluk analytics rollup (§28)
--
-- Panel ham tabloyu taramaz. Bu fonksiyon pg_cron ile gecelik calistirilir;
-- ayrica elle de cagrilabilir. Idempotent: ayni gun icin tekrar calisirsa
-- sayilari uzerine yazar, toplamaz.
-- ---------------------------------------------------------------------------
create or replace function public.rollup_analytics_daily(target_day date default (current_date - 1))
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  insert into public.analytics_daily (business_id, day, event_type, event_count, updated_at)
  select
    e.business_id,
    target_day,
    e.event_type,
    count(*)::integer,
    now()
  from public.analytics_events e
  where e.business_id is not null
    and e.created_at >= target_day::timestamptz
    and e.created_at <  (target_day + 1)::timestamptz
  group by e.business_id, e.event_type
  on conflict (business_id, day, event_type)
  do update set event_count = excluded.event_count, updated_at = now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

comment on function public.rollup_analytics_daily(date) is
  'Bir gunun ham olaylarini analytics_daily''ye ozetler. Idempotent.';

revoke execute on function public.rollup_analytics_daily(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ham analytics olaylarini 90 gun sonra sil (KVKK veri minimizasyonu, §56)
--
-- Ozet (analytics_daily) kalir, ham kayit gider.
-- ---------------------------------------------------------------------------
create or replace function public.prune_analytics_events(retention_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  delete from public.analytics_events
  where created_at < now() - make_interval(days => retention_days);

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke execute on function public.prune_analytics_events(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Claim onaylandiginda isletmeyi sahiplendir
--
-- Iki tabloyu tutarli tutmak uygulama katmanina birakilmaz: onay ile sahiplik
-- ayni islemde degismelidir.
-- ---------------------------------------------------------------------------
create or replace function public.apply_approved_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    update public.businesses
    set owner_id            = new.user_id,
        claimed_at          = coalesce(new.approved_at, now()),
        verification_status = 'owner_claimed',
        last_verified_at    = coalesce(new.approved_at, now()),
        verified_by         = new.reviewed_by
    where id = new.business_id;

    -- Sahiplenen kullanici artik isletme sahibidir.
    update public.profiles
    set role = 'business_owner'
    where id = new.user_id and role = 'customer';
  end if;

  return new;
end;
$$;

create trigger claims_apply_approved
  after update of status on public.claims
  for each row execute function public.apply_approved_claim();

-- ---------------------------------------------------------------------------
-- landing_page_stats — thin content kapisi (§31)
--
-- Bir landing page'e dusen GERCEK aktif isletme sayisini hesaplar ve esigin
-- altindaysa sayfayi indexlenemez olarak isaretler. Sitemap ve robots meta
-- dogrudan bu view'i okur; yani kural kodda degil, veritabaninda yasar.
-- ---------------------------------------------------------------------------
create or replace view public.landing_page_stats
with (security_invoker = true)
as
select
  lp.id,
  lp.slug,
  lp.title,
  lp.h1,
  lp.intro,
  lp.meta_description,
  lp.location_id,
  lp.service_id,
  lp.min_business_count,
  lp.is_published,
  lp.sort_order,
  count(distinct b.id)::integer as business_count,
  (lp.is_published and count(distinct b.id) >= lp.min_business_count) as is_indexable
from public.landing_pages lp
left join public.businesses b
  on b.status = 'active'
  and (lp.location_id is null or exists (
        select 1 from public.business_locations bl
        where bl.business_id = b.id and bl.location_id = lp.location_id))
  and (lp.service_id is null or exists (
        select 1 from public.business_services bs
        where bs.business_id = b.id and bs.service_id = lp.service_id))
group by lp.id;

comment on view public.landing_page_stats is
  'Landing page + gercek aktif isletme sayisi. is_indexable=false olan sayfa '
  'noindex alir ve sitemap''e girmez (§31 thin content kapisi).';
