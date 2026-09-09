-- Kütahya Taksi Ağı — admin panel temeli (Faz 9a, R9, §51)
--
-- Üç bağımsız değişiklik tek migration'da toplandı çünkü hepsi Faz 9a'nın
-- ön koşulu: (1) R9 — ilk admin'i bootstrap etmenin dokümante edilmiş bir
-- yolu yoktu (PROJECT_PLAN.md R9), (2) claim onay/red için SQL fonksiyonu
-- yoktu — istemcinin `claims_status_timestamps` kısıtına uyan çok kolonlu
-- bir UPDATE'i doğru sırayla göndermesi gerekiyordu, hataya açık, (3) admin
-- hızlı-ekle formu (§51) `submit_business`'ın slug mantığını TEKRARLAMAMALI.

-- ---------------------------------------------------------------------------
-- R9 — ilk admin bootstrap istisnası.
--
-- `protect_profile_role()` (20260908150300) `role` değişen HER UPDATE'i
-- `is_admin()` DEĞİLSE reddediyordu — sistemde henüz hiç admin yokken bunu
-- "meşru" şekilde aşacak hiçbir yol yoktu (bkz. PROJECT_PLAN.md R9, Faz 7'de
-- canlıda keşfedildi). Aşağıdaki istisna DAR ve KENDİLİĞİNDEN KAPANIR:
--   - yalnızca KENDİ satırını ('new.id = auth.uid()') admin yapabilirsin,
--     başkasını admin yapamazsın;
--   - yalnızca sistemde HİÇ admin yokken çalışır — bir admin var olduğu an
--     `not exists (...)` koşulu daima false döner ve bu yol kalıcı olarak
--     kapanır, arka kapı olarak kalmaz.
-- Kullanım: normal şekilde `/giris`den kayıt ol, sonra KENDİ hesabınla bir
-- kere `PATCH /rest/v1/profiles?id=eq.<uid>` ile `{"role":"admin"}` gönder
-- (bkz. README.md "İlk admin'i oluşturma"). Migration/seed'e YAZILMADI —
-- production'da migration geçmişi tekrar çalışmaz, bu yüzden dokümante
-- edilmiş bir tek-seferlik kullanıcı eylemi tercih edildi.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    if public.is_admin() then
      return new;
    end if;

    if new.role = 'admin'
       and new.id = (select auth.uid())
       and not exists (select 1 from public.profiles where role = 'admin')
    then
      return new;
    end if;

    raise exception 'Kullanici kendi rolunu degistiremez.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- unique_business_slug — `submit_business`'ın (Faz 8) slug üretim döngüsü
-- BURAYA taşındı; hem `submit_business` hem yeni `admin_quick_add_business`
-- AYNI fonksiyonu çağırır. Tek yerde tutulmazsa iki yol zamanla farklı
-- benzersizlik mantığına sahip olup slug çakışması üretebilirdi.
-- ---------------------------------------------------------------------------
create or replace function public.unique_business_slug(base_name text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_base_slug text;
  v_slug      text;
  v_suffix    integer := 1;
begin
  v_base_slug := coalesce(public.slugify(base_name), 'isletme');
  v_slug := v_base_slug;
  while exists (
    select 1 from public.businesses b where b.slug = v_slug
    union all
    select 1 from public.business_slug_history h where h.old_slug = v_slug
  ) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  end loop;
  return v_slug;
end;
$$;

comment on function public.unique_business_slug(text) is
  'Isletme adindan benzersiz slug uretir (aktif + gecmis slug''lara karsi). '
  '`submit_business` ve `admin_quick_add_business` PAYLASIR.';

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
  v_slug            text;
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

  v_phone_e164 := public.normalize_tr_phone(p_phone);
  if nullif(trim(coalesce(p_phone, '')), '') is not null and v_phone_e164 is null then
    raise exception 'Telefon numarasi taninamadi. Ornek: 0555 111 22 33' using errcode = '22023';
  end if;

  v_whatsapp_e164 := public.normalize_tr_phone(p_whatsapp);
  if nullif(trim(coalesce(p_whatsapp, '')), '') is not null and v_whatsapp_e164 is null then
    raise exception 'WhatsApp numarasi taninamadi. Ornek: 0555 111 22 33' using errcode = '22023';
  end if;

  v_website := nullif(trim(coalesce(p_website, '')), '');
  if v_website is not null and v_website !~* '^https?://' then
    v_website := 'https://' || v_website;
  end if;

  select c.id into v_category_id from public.categories c where c.slug = 'taksi' limit 1;
  v_slug := public.unique_business_slug(p_business_name);

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

-- ---------------------------------------------------------------------------
-- admin_quick_add_business — hızlı veri girişi (§51).
--
-- `submit_business`den FARKI: admin-only, owner YOK, status doğrudan
-- 'active' (admin'in kendi girdiği veri onay kuyruğu beklemez), olası-kopya
-- taraması YOK (admin kendi girdiğine güvenir — bu bir kullanıcı beyanı
-- değil, ekip tarafından toplanan kaynak veridir, §52'nin çözmeye çalıştığı
-- "aynı kullanıcı yanlışlıkla iki kez gönderdi" sorunu burada yok).
-- ---------------------------------------------------------------------------
create or replace function public.admin_quick_add_business(
  p_business_name text,
  p_phone         text default null,
  p_whatsapp      text default null,
  p_address       text default null,
  p_district      text default null,
  p_neighborhood  text default null,
  p_description   text default null,
  p_website       text default null
)
returns table (id uuid, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category_id   uuid;
  v_slug          text;
  v_phone_e164    text;
  v_whatsapp_e164 text;
  v_website       text;
  v_new_id        uuid;
begin
  if not public.is_admin() then
    raise exception 'Bu islem yalnizca yoneticiler icindir.' using errcode = '42501';
  end if;

  if nullif(trim(p_business_name), '') is null then
    raise exception 'Isletme adi zorunludur.' using errcode = '22023';
  end if;

  v_phone_e164 := public.normalize_tr_phone(p_phone);
  if nullif(trim(coalesce(p_phone, '')), '') is not null and v_phone_e164 is null then
    raise exception 'Telefon numarasi taninamadi. Ornek: 0555 111 22 33' using errcode = '22023';
  end if;

  v_whatsapp_e164 := public.normalize_tr_phone(p_whatsapp);
  if nullif(trim(coalesce(p_whatsapp, '')), '') is not null and v_whatsapp_e164 is null then
    raise exception 'WhatsApp numarasi taninamadi. Ornek: 0555 111 22 33' using errcode = '22023';
  end if;

  v_website := nullif(trim(coalesce(p_website, '')), '');
  if v_website is not null and v_website !~* '^https?://' then
    v_website := 'https://' || v_website;
  end if;

  select c.id into v_category_id from public.categories c where c.slug = 'taksi' limit 1;
  v_slug := public.unique_business_slug(p_business_name);

  insert into public.businesses (
    category_id, business_name, slug, phone_e164, whatsapp_e164,
    address, district, neighborhood, description, website,
    status, source_type, verification_status
  ) values (
    v_category_id, trim(p_business_name), v_slug, v_phone_e164, v_whatsapp_e164,
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_district, '')), ''),
    nullif(trim(coalesce(p_neighborhood, '')), ''),
    nullif(trim(coalesce(p_description, '')), ''),
    v_website,
    'active', 'manual', 'unverified'
  )
  returning businesses.id into v_new_id;

  return query select v_new_id, v_slug;
end;
$$;

comment on function public.admin_quick_add_business(text, text, text, text, text, text, text, text) is
  'Admin hizli veri girisi RPC''si (§51). Owner YOK, status dogrudan active, kopya taramasi YOK.';

revoke execute on function public.admin_quick_add_business(text, text, text, text, text, text, text, text)
  from public, anon;
grant execute on function public.admin_quick_add_business(text, text, text, text, text, text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- approve_claim / reject_claim — claim inceleme RPC'leri.
--
-- Neden RPC, neden çıplak UPDATE değil? `claims_status_timestamps` CHECK
-- kısıtı (20260908150100) status/approved_at/rejected_at'in TUTARLI
-- gönderilmesini zorunlu kılıyor — istemcinin bunu her seferinde doğru
-- sırayla elle kurması hataya açık. `where status = 'pending'` + `if not
-- found` ile aynı talebin iki admin tarafından aynı anda islenmesi de
-- (ya da zaten islenmis bir talebin tekrar islenmesi de) SESSIZCE
-- yutulmuyor, acik bir hata donuyor.
-- ---------------------------------------------------------------------------
create or replace function public.approve_claim(p_claim_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Bu islem yalnizca yoneticiler icindir.' using errcode = '42501';
  end if;

  update public.claims
  set status        = 'approved',
      approved_at   = now(),
      rejected_at   = null,
      reviewed_by   = (select auth.uid()),
      reviewer_note = coalesce(nullif(trim(p_note), ''), reviewer_note)
  where id = p_claim_id
    and status = 'pending';

  if not found then
    raise exception 'Talep bulunamadi veya zaten islenmis.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.reject_claim(p_claim_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Bu islem yalnizca yoneticiler icindir.' using errcode = '42501';
  end if;

  update public.claims
  set status        = 'rejected',
      rejected_at   = now(),
      approved_at   = null,
      reviewed_by   = (select auth.uid()),
      reviewer_note = coalesce(nullif(trim(p_note), ''), reviewer_note)
  where id = p_claim_id
    and status = 'pending';

  if not found then
    raise exception 'Talep bulunamadi veya zaten islenmis.' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.approve_claim(uuid, text) is
  'Claim onay RPC''si — admin-only. status/approved_at/reviewed_by''i atomik gunceller.';
comment on function public.reject_claim(uuid, text) is
  'Claim red RPC''si — admin-only. status/rejected_at/reviewed_by''i atomik gunceller.';

revoke execute on function public.approve_claim(uuid, text) from public, anon;
grant execute on function public.approve_claim(uuid, text) to authenticated;
revoke execute on function public.reject_claim(uuid, text) from public, anon;
grant execute on function public.reject_claim(uuid, text) to authenticated;
