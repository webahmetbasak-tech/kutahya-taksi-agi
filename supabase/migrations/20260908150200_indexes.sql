-- Kütahya Taksi Ağı — indexler
--
-- Her index bir sorgu icin var; "ihtimale karsi" index eklenmedi.

-- --- businesses -------------------------------------------------------------

-- Public listeleme: status='active' filtresi her public sorguda var.
create index businesses_active_idx
  on public.businesses (category_id, created_at desc)
  where status = 'active';

-- Detay sayfasi slug ile gelir (unique constraint zaten index saglar, ek yok).

-- Admin kuyrugu: bekleyen basvurular.
create index businesses_status_idx on public.businesses (status);

-- Panel: kullanicinin kendi isletmeleri.
create index businesses_owner_idx on public.businesses (owner_id) where owner_id is not null;

-- "Yakinimdaki taksiler" — ST_DWithin bu index'i kullanir (§49).
create index businesses_geo_idx
  on public.businesses using gist (geo)
  where status = 'active' and geo is not null;

-- Duplicate tespiti (§52): benzer isim aramasi icin trigram.
create index businesses_name_normalized_trgm_idx
  on public.businesses using gin (name_normalized extensions.gin_trgm_ops);

-- Duplicate tespiti: ayni telefon farkli kayitlarda mi?
-- UNIQUE DEGIL: ayni durakta birden fazla kayit mesru olabilir, karar admin'in (§52).
create index businesses_phone_idx
  on public.businesses (phone_e164)
  where phone_e164 is not null;

-- Bolge sayfalari il/ilce ile filtreler.
create index businesses_district_idx
  on public.businesses (city, district)
  where status = 'active';

-- --- iliskiler --------------------------------------------------------------

-- M2M tablolarinda PK (business_id, x) soldan indexlidir; ters yon icin gerekli.
create index business_services_service_idx  on public.business_services (service_id);
create index business_locations_location_idx on public.business_locations (location_id);

create index business_media_business_idx
  on public.business_media (business_id, sort_order);

create index business_hours_business_idx on public.business_hours (business_id);

-- --- locations --------------------------------------------------------------

create index locations_parent_idx on public.locations (parent_id);
create index locations_type_idx   on public.locations (type);

-- --- claims -----------------------------------------------------------------

-- Admin inceleme kuyrugu.
create index claims_status_idx on public.claims (status, submitted_at);
create index claims_user_idx   on public.claims (user_id);
create index claims_business_idx on public.claims (business_id);

-- --- reviews ----------------------------------------------------------------

create index reviews_business_idx on public.reviews (business_id, status);

-- --- analytics --------------------------------------------------------------

-- Ham olaylar zaman siralamasinda yazilir ve zaman araligiyla okunur/silinir.
-- BRIN, bu erisim deseninde B-tree'ye gore cok daha kucuk kalir.
create index analytics_events_created_at_brin
  on public.analytics_events using brin (created_at);

-- Gunluk rollup isi: belirli gunun olaylarini isletmeye gore gruplar.
create index analytics_events_rollup_idx
  on public.analytics_events (created_at, business_id, event_type)
  where business_id is not null;

-- Ayni oturumun ayni isletmedeki ayni olayi kisa surede tekrar saymasin diye
-- kullanilan tekrar kontrolu (§ ARCHITECTURE 7) bu index uzerinden calisir.
create index analytics_events_dedupe_idx
  on public.analytics_events (session_id, business_id, event_type, created_at desc)
  where business_id is not null;

-- Panel istatistikleri: isletmenin son N gunu.
create index analytics_daily_business_day_idx
  on public.analytics_daily (business_id, day desc);

-- --- landing pages ----------------------------------------------------------

create index landing_pages_published_idx
  on public.landing_pages (is_published, sort_order)
  where is_published;

create index landing_pages_location_idx on public.landing_pages (location_id);
create index landing_pages_service_idx  on public.landing_pages (service_id);

-- --- slug history -----------------------------------------------------------

create index business_slug_history_business_idx on public.business_slug_history (business_id);
