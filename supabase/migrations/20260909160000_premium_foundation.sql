-- Kütahya Taksi Ağı — premium temeli (Faz 10, §58)
--
-- `businesses.plan` (free/pro/premium) Faz 2'den beri şemada var ama HİÇBİR
-- davranış farkı bağlı değildi. Bu migration TEK bir gerçek özellik farkını
-- ekliyor: fotoğraf sayısı sınırı (free=3, pro/premium=sınırsız). BİLEREK
-- sıralama/görünürlük DEĞİL (§58, R8) — yalnızca içerik zenginliği.
--
-- Ödeme entegrasyonu YOK (plan hâlâ yalnızca admin tarafından elle
-- değiştiriliyor, bkz. `protect_business_admin_columns`) — "gerçekten
-- gerekli olduğunda eklenir" (PROJECT_PLAN.md Faz 10).

-- ---------------------------------------------------------------------------
-- Yalnızca `media_type = 'photo'` sınırlanır — `logo`/`cover` tekil varlıklar
-- (bir işletmenin en fazla bir logosu/kapak görseli olur mantığıyla), bir
-- "galeri" değil; onları sınırlamak yanlış olurdu.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_business_media_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan  public.business_plan;
  v_count integer;
  v_limit constant integer := 3;
begin
  if new.media_type <> 'photo' then
    return new;
  end if;

  select b.plan into v_plan from public.businesses b where b.id = new.business_id;
  if v_plan is distinct from 'free' then
    return new;
  end if;

  select count(*) into v_count
  from public.business_media m
  where m.business_id = new.business_id and m.media_type = 'photo';

  if v_count >= v_limit then
    raise exception
      'Ucretsiz planda en fazla % fotograf eklenebilir. Daha fazlasi icin plan yukseltilmeli.',
      v_limit
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.enforce_business_media_limit() is
  'Faz 10, §58: free planda en fazla 3 "photo" — pro/premium sinirsiz. Siralamayi ETKILEMEZ.';

create trigger business_media_enforce_limit
  before insert on public.business_media
  for each row execute function public.enforce_business_media_limit();

-- ---------------------------------------------------------------------------
-- `nearby_businesses` (Faz 5) `plan`'ı DÖNDÜRMÜYORDU — "Öne Çıkan" rozeti
-- (taxi-card.ts) yakınımdaki taksiler sonuçlarında hiç görünmezdi.
-- `RETURNS TABLE` kolon listesi `create or replace` ile DEĞİŞTİRİLEMEZ,
-- bu yüzden önce düşürülüyor.
-- ---------------------------------------------------------------------------
drop function if exists public.nearby_businesses(double precision, double precision, integer);

create function public.nearby_businesses(
  lat double precision,
  lon double precision,
  radius_meters integer default 15000
)
returns table (
  id uuid,
  slug text,
  business_name text,
  phone_e164 text,
  phone_display text,
  whatsapp_e164 text,
  district text,
  neighborhood text,
  verification_status public.verification_status,
  last_verified_at timestamptz,
  google_maps_url text,
  plan public.business_plan,
  distance_meters double precision
)
language sql
stable
set search_path = ''
as $$
  select
    b.id, b.slug, b.business_name, b.phone_e164, b.phone_display, b.whatsapp_e164,
    b.district, b.neighborhood, b.verification_status, b.last_verified_at, b.google_maps_url,
    b.plan,
    extensions.st_distance(
      b.geo,
      extensions.st_setsrid(extensions.st_makepoint(lon, lat), 4326)::extensions.geography
    ) as distance_meters
  from public.businesses b
  where b.status = 'active'
    and b.geo is not null
    and extensions.st_dwithin(
      b.geo,
      extensions.st_setsrid(extensions.st_makepoint(lon, lat), 4326)::extensions.geography,
      radius_meters
    )
  order by distance_meters asc
  limit 50;
$$;

comment on function public.nearby_businesses(double precision, double precision, integer) is
  'Konuma en yakin aktif isletmeler (§49). RLS''i bypass etmez, ustune mesafe filtresi ekler.';

grant execute on function public.nearby_businesses(double precision, double precision, integer)
  to anon, authenticated;
