-- Kütahya Taksi Ağı — "Şoför Ad Soyad" alanı (/isletme-ekle formu sadeleştirmesi)
--
-- İşletme sahibi hesabının adı (profiles.full_name) her zaman ARACI KULLANAN
-- şoförle aynı kişi olmayabilir (ör. bir kişi hesabı açıp başka birine ait
-- taksiyi ekliyor olabilir) — bu yüzden ayrı, isteğe bağlı bir metin alanı.
alter table public.businesses
  add column driver_name text;

comment on column public.businesses.driver_name is
  'İşletmeyi fiilen kullanan şoförün adı soyadı (isteğe bağlı, hesap sahibinden farklı olabilir).';

create or replace function public.submit_business(
  p_business_name text,
  p_phone         text default null,
  p_whatsapp      text default null,
  p_address       text default null,
  p_district      text default null,
  p_neighborhood  text default null,
  p_description   text default null,
  p_website       text default null,
  p_driver_name   text default null
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
    address, district, neighborhood, description, website, driver_name,
    status, source_type, verification_status,
    owner_id, possible_duplicate_of
  ) values (
    v_category_id, trim(p_business_name), v_slug, v_phone_e164, v_whatsapp_e164,
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_district, '')), ''),
    nullif(trim(coalesce(p_neighborhood, '')), ''),
    nullif(trim(coalesce(p_description, '')), ''),
    v_website,
    nullif(trim(coalesce(p_driver_name, '')), ''),
    'pending', 'owner_submitted', 'unverified',
    v_user_id, v_duplicate_id
  )
  returning businesses.id into v_new_id;

  return query select v_new_id, v_slug, (v_duplicate_id is not null);
end;
$$;
