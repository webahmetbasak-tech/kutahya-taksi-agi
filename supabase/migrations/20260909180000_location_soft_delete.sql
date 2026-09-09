-- Kütahya Taksi Ağı — lokasyonlar için aktif/pasif (soft delete)
--
-- `AdminLocationRepository` (Faz 9b) bilerek sert DELETE vermiyordu:
-- `business_locations.location_id` `on delete cascade`, `landing_pages.location_id`
-- `on delete set null` — bir lokasyonu silmek işletme etiketlerini/landing
-- page hedeflemesini SESSİZCE bozardı. `services` tablosu aynı sorunu
-- `is_active` ile çözmüştü (bkz. 20260908150100_core_tables.sql); `locations`
-- için aynı kolon eksikti — admin panelde "kaldır" seçeneği bu yüzden yoktu.
alter table public.locations
  add column is_active boolean not null default true;

comment on column public.locations.is_active is
  'false ise public sayfalarda/sitemap''ta/llms.txt''te gizlenir ama '
  'business_locations/landing_pages ilişkileri KORUNUR (services.is_active ile aynı desen).';
