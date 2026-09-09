-- Kütahya Taksi Ağı — işletme öz-başvurusu (Faz 8, §26, §52)
--
-- `20260908150400_rls.sql` şu notu bırakmıştı: "İşletme ekleme Faz 8'de
-- kontrollü bir RPC üzerinden yapılacak. Doğrudan INSERT policy'si BİLEREK
-- verilmiyor: anon'a serbest insert vermek rehberi spam'e açardı." Bu migration
-- o RPC'yi ekliyor: slug üretimi + benzersizlik, telefon normalizasyonu,
-- olası kopya işaretleme (§52 — OTOMATİK SİLME/REDDETME YOK, yalnızca admin'e
-- işaretlenir) hepsi TEK atomik fonksiyonda.

-- ---------------------------------------------------------------------------
-- Olası kopya işaretleme (§52) — admin panel (Faz 9) bunu okuyup karar verir.
-- ---------------------------------------------------------------------------
alter table public.businesses
  add column possible_duplicate_of uuid references public.businesses(id) on delete set null;

comment on column public.businesses.possible_duplicate_of is
  'Gonderim sirasinda isim benzerligi/telefon eslesmesiyle bulunan olasi kopya. '
  'OTOMATIK SILME/REDDETME YOK (§52) — yalnizca admin incelemesi icin isaret.';

-- `protect_business_admin_columns` (20260908150300) yalnizca O TARIHTE var olan
-- kolonlari listeliyordu. `possible_duplicate_of` de ayni sekilde yalnizca admin
-- tarafindan degistirilebilmeli (§52) — sahip kendi kaydini `businesses_update_own`
-- ile PATCH edebildigi icin (bkz. 20260908150400_rls.sql), bu kisit trigger'da
-- YOKSA sahip kendi olasi-kopya isaretini sessizce temizleyebilirdi.
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
     or new.possible_duplicate_of is distinct from old.possible_duplicate_of
  then
    raise exception 'Bu alanlar yalnizca yonetici tarafindan degistirilebilir.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- slug üretimi — Türkçe karakterleri çözer, businesses_slug_format kısıtına
-- (^[a-z0-9]+(-[a-z0-9]+)*$) her zaman uyar. `normalize_name()`den farkı:
-- boşlukları TİRE yapar (kelime ayrımı URL'de korunur), tek boşluğa değil.
-- ---------------------------------------------------------------------------
create or replace function public.slugify(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(value, ''))),
        '[^a-z0-9]+', '-', 'g'
      ),
      '(^-+)|(-+$)', '', 'g'
    ),
    ''
  );
$$;

comment on function public.slugify(text) is
  'Isletme adindan URL slug uretir. businesses_slug_format kisitina her zaman uyar.';

-- ---------------------------------------------------------------------------
-- submit_business — kontrollü işletme ekleme RPC'si.
--
-- Yalnızca `authenticated` çağırabilir (anon spam önlemi — §26 aynı zamanda
-- Faz 7'nin "zaten var olan bir işletmeyi sahiplen" akışından FARKLIDIR: burada
-- çağıran kullanıcı YENİ kaydın owner_id'si olur, çünkü bu "kendi işletmeni
-- ekle" akışıdır).
-- ---------------------------------------------------------------------------
create or replace function public.submit_business(
  p_business_name text,
  p_phone         text default null,
  p_whatsapp      text default null,
  p_address       text default null,
  p_district      text default null,
  p_neighborhood  text default null,
  p_description   text default null,
  p_website       text default null
)
returns table (id uuid, slug text, possible_duplicate boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id         uuid := (select auth.uid());
  v_category_id     uuid;
  v_base_slug       text;
  v_slug            text;
  v_suffix          integer := 1;
  v_phone_e164      text;
  v_whatsapp_e164   text;
  v_website         text;
  v_name_normalized text;
  v_duplicate_id    uuid;
  v_new_id          uuid;
begin
  if v_user_id is null then
    raise exception 'Isletme eklemek icin giris yapmis olmaniz gerekir.' using errcode = '42501';
  end if;

  if nullif(trim(p_business_name), '') is null then
    raise exception 'Isletme adi zorunludur.' using errcode = '22023';
  end if;

  -- Telefon/whatsapp: taninmayan bicimde SESSIZCE NULL yazmak yerine acikca
  -- reddedilir — kullanici yanlislikla telefonsuz bir profil yayinlamasin.
  v_phone_e164 := public.normalize_tr_phone(p_phone);
  if nullif(trim(coalesce(p_phone, '')), '') is not null and v_phone_e164 is null then
    raise exception 'Telefon numarasi taninamadi. Ornek: 0555 111 22 33' using errcode = '22023';
  end if;

  v_whatsapp_e164 := public.normalize_tr_phone(p_whatsapp);
  if nullif(trim(coalesce(p_whatsapp, '')), '') is not null and v_whatsapp_e164 is null then
    raise exception 'WhatsApp numarasi taninamadi. Ornek: 0555 111 22 33' using errcode = '22023';
  end if;

  -- Web sitesi: sema http(s):// bekliyor (businesses_website_scheme); kullanici
  -- yazmamissa nazikce ekleriz, hatali URL'yi TEKRAR uydurmayiz.
  v_website := nullif(trim(coalesce(p_website, '')), '');
  if v_website is not null and v_website !~* '^https?://' then
    v_website := 'https://' || v_website;
  end if;

  select c.id into v_category_id from public.categories c where c.slug = 'taksi' limit 1;

  -- Slug: taban + gerekirse -2, -3... hem aktif slug'lara hem gecmis
  -- (business_slug_history) slug'lara karsi benzersiz olmali — aksi halde
  -- eski bir 301 yonlendirmesini "calar".
  v_base_slug := coalesce(public.slugify(p_business_name), 'isletme');
  v_slug := v_base_slug;
  while exists (
    select 1 from public.businesses b where b.slug = v_slug
    union all
    select 1 from public.business_slug_history h where h.old_slug = v_slug
  ) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  end loop;

  -- §52 olasi kopya: ayni telefon NUMARASI (guclu sinyal) YA DA isim benzerligi
  -- (esik 0.4, deneysel — cok dusuk yanlis pozitif verir). Durum FARK ETMEZ:
  -- pending/rejected kayitlar da adaydir, cunku ayni isletme birden fazla kez
  -- gonderilmis olabilir.
  v_name_normalized := public.normalize_name(p_business_name);
  select b.id into v_duplicate_id
  from public.businesses b
  where (v_phone_e164 is not null and b.phone_e164 = v_phone_e164)
     or extensions.similarity(b.name_normalized, v_name_normalized) > 0.4
  order by (v_phone_e164 is not null and b.phone_e164 = v_phone_e164) desc,
           extensions.similarity(b.name_normalized, v_name_normalized) desc
  limit 1;

  insert into public.businesses (
    category_id, business_name, slug, phone_e164, whatsapp_e164,
    address, district, neighborhood, description, website,
    status, source_type, verification_status,
    owner_id, possible_duplicate_of
  ) values (
    v_category_id, trim(p_business_name), v_slug, v_phone_e164, v_whatsapp_e164,
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_district, '')), ''),
    nullif(trim(coalesce(p_neighborhood, '')), ''),
    nullif(trim(coalesce(p_description, '')), ''),
    v_website,
    'pending', 'owner_submitted', 'unverified',
    v_user_id, v_duplicate_id
  )
  returning businesses.id into v_new_id;

  return query select v_new_id, v_slug, (v_duplicate_id is not null);
end;
$$;

comment on function public.submit_business(text, text, text, text, text, text, text, text) is
  'Isletme sahibinin kendi isletmesini eklemesi icin kontrollu RPC (§26). '
  'Dogrudan INSERT policy YOK; tum dogrulama/slug/duplicate mantigi burada.';

revoke execute on function public.submit_business(text, text, text, text, text, text, text, text)
  from public, anon;
grant execute on function public.submit_business(text, text, text, text, text, text, text, text)
  to authenticated;
