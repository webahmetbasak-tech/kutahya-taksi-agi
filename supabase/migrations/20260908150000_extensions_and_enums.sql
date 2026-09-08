-- Kütahya Taksi Ağı — uzantılar ve enum tipleri
--
-- Uzantılar Supabase konvansiyonuna uyarak `extensions` şemasına kurulur; bu yüzden
-- PostGIS tipleri ve fonksiyonları kodda şema nitelemesiyle (`extensions.`) çağrılır.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Enum tipleri
--
-- Serbest metin yerine enum kullanmak, "aktif" ile "active" gibi sessiz veri
-- bozulmalarını veritabanı seviyesinde imkânsız kılar.
-- ---------------------------------------------------------------------------

-- İşletmenin yayın durumu. Yalnızca 'active' olanlar public'e görünür.
create type public.business_status as enum (
  'pending',    -- başvuru alındı, admin incelemesi bekliyor
  'active',     -- yayında
  'suspended',  -- geçici olarak yayından kaldırıldı
  'rejected',   -- başvuru reddedildi
  'archived'    -- kalıcı olarak kaldırıldı (URL 410 döner)
);

-- Bilginin ne kadar güvenilir olduğunu ifade eder. Güven rozetleri buradan gelir.
create type public.verification_status as enum (
  'unverified',   -- bilgi var ama doğrulanmadı
  'pending',      -- doğrulama süreci başladı
  'verified',     -- ekip tarafından doğrulandı (ör. telefon arandı)
  'owner_claimed' -- işletme sahibi sahiplendi ve doğrulandı
);

-- Verinin nereden geldiği. §20 gereği her kayıt için ZORUNLU.
create type public.source_type as enum (
  'manual',                  -- ekip elle girdi
  'public_business_listing', -- kamuya açık ilan (ör. durak levhası)
  'owner_submitted',         -- işletme sahibi bildirdi
  'owner_verified',          -- işletme sahibi doğrulandıktan sonra güncelledi
  'osm'                      -- OpenStreetMap (ODbL, atıf gerektirir)
);

create type public.location_type as enum (
  'city', 'district', 'neighborhood', 'landmark',
  'airport', 'hospital', 'university', 'bus_station'
);

create type public.claim_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create type public.verification_method as enum (
  'phone_otp',    -- SMS doğrulama kodu
  'callback',     -- işletmeyi arayarak doğrulama
  'document',     -- belge ile doğrulama
  'manual_admin'  -- admin elle doğruladı (MVP varsayılanı — R6)
);

create type public.user_role as enum ('customer', 'business_owner', 'admin');

create type public.review_status as enum ('pending', 'approved', 'rejected');

create type public.media_type as enum ('logo', 'photo', 'cover');

-- Premium altyapısı (§57). V1'de herkes 'free'; ödeme entegrasyonu yok.
create type public.business_plan as enum ('free', 'pro', 'premium');

create type public.analytics_event_type as enum (
  'profile_view',
  'call_click',
  'whatsapp_click',
  'directions_click',
  'website_click',
  'claim_started',
  'claim_completed',
  'listing_submitted',
  'listing_approved',
  'search_performed'
);
