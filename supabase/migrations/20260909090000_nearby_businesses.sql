-- Kütahya Taksi Ağı — "Yakınımdaki Taksiler" (§49)
--
-- Faz 2'de businesses.geo (PostGIS geography) ve GIST index bu sorgu icin
-- kuruldu. Bu fonksiyon olmadan o index kullanilmaz.
--
-- SECURITY INVOKER (varsayilan): fonksiyon cagiran rolun RLS'i altinda calisir.
-- businesses_select_active policy'si zaten anon'a yalnizca status='active'
-- gosteriyor; RPC bu kurali BYPASS ETMEZ, ustune ekstra bir filtre (mesafe)
-- ekler. Yani RPC'nin dondurdugu satirlar, /businesses?select=* ile zaten
-- gorulebilecek satirlarin bir alt kumesidir — yeni bir veri sizintisi yok.
create or replace function public.nearby_businesses(
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
  distance_meters double precision
)
language sql
stable
set search_path = ''
as $$
  select
    b.id, b.slug, b.business_name, b.phone_e164, b.phone_display, b.whatsapp_e164,
    b.district, b.neighborhood, b.verification_status, b.last_verified_at, b.google_maps_url,
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
