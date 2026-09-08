-- Kütahya Taksi Ağı — çekirdek tablolar

-- ---------------------------------------------------------------------------
-- Yardımcı: metin normalizasyonu
--
-- Duplicate tespiti (§52) ve arama için Türkçe'ye duyarlı normalizasyon.
-- IMMUTABLE olmak zorunda çünkü generated column ve index içinde kullanılıyor.
-- `unaccent` varsayılan olarak STABLE'dır; sözlüğü açıkça vererek IMMUTABLE hale
-- getirilmiş bir sarmalayıcı kullanıyoruz.
-- ---------------------------------------------------------------------------
create or replace function public.normalize_name(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(
    regexp_replace(
      lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(value, ''))),
      '[^a-z0-9]+', ' ', 'g'
    ),
    ''
  );
$$;

comment on function public.normalize_name(text) is
  'Duplicate tespiti icin metni normalize eder: kucuk harf, aksan yok, yalnizca alfanumerik.';

-- ---------------------------------------------------------------------------
-- categories — dikey (§80). MVP'de tek satır: taksi.
-- ---------------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default extensions.gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

comment on table public.categories is
  'Isletme dikeyi. MVP yalnizca taksi; restoran/kuafor vb. ileride buraya eklenir.';

-- ---------------------------------------------------------------------------
-- profiles — Supabase Auth kullanicilarinin uygulama profili
-- ---------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  phone_e164 text,
  role       public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'auth.users ile 1-1. id dogrudan auth.users.id degeridir.';
comment on column public.profiles.role is
  'Yetki kaynagi. Kullanici bu alani KENDI degistiremez (RLS + trigger).';

-- ---------------------------------------------------------------------------
-- services — hizmet turleri (§10)
-- ---------------------------------------------------------------------------
create table public.services (
  id          uuid primary key default extensions.gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- locations — yerel SEO ve entity mimarisi (§12)
--
-- Hiyerarsik: sehir > ilce > mahalle. Landmark'lar (havalimani, hastane,
-- universite, otogar) bagli olduklari ilceye parent_id ile baglanir.
-- ---------------------------------------------------------------------------
create table public.locations (
  id          uuid primary key default extensions.gen_random_uuid(),
  parent_id   uuid references public.locations(id) on delete restrict,
  type        public.location_type not null,
  slug        text not null unique,
  name        text not null,
  description text,
  latitude    double precision,
  longitude   double precision,
  source_type public.source_type not null default 'manual',
  source_note text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint locations_latitude_range  check (latitude is null or latitude between -90 and 90),
  constraint locations_longitude_range check (longitude is null or longitude between -180 and 180),
  -- Koordinat ya tam verilir ya hic verilmez; yarim koordinat sessiz hata kaynagidir.
  constraint locations_coords_paired check (
    (latitude is null and longitude is null) or (latitude is not null and longitude is not null)
  ),
  constraint locations_no_self_parent check (parent_id is null or parent_id <> id)
);

comment on table public.locations is
  'Lokasyon hiyerarsisi. Internal linking ve landing page hedeflemesinin omurgasi (§42).';

-- ---------------------------------------------------------------------------
-- businesses — cekirdek tablo (§7)
-- ---------------------------------------------------------------------------
create table public.businesses (
  id            uuid primary key default extensions.gen_random_uuid(),
  category_id   uuid not null references public.categories(id) on delete restrict,

  business_name text not null,
  -- Duplicate tespiti icin generated: elle guncellenemez, bu yuzden bayatlayamaz.
  name_normalized text generated always as (public.normalize_name(business_name)) stored,
  slug          text not null unique,
  description   text,

  -- Telefon: kanonik E.164 saklanir, gosterim ayri tutulur (§53).
  -- NULL OLABILIR ve bu kasitlidir: dogrulanmamis numara uydurulmaz (§20).
  phone_e164    text,
  phone_display text,
  whatsapp_e164 text,

  address       text,
  city          text not null default 'Kütahya',
  district      text,
  neighborhood  text,

  latitude      double precision,
  longitude     double precision,
  -- Mesafe sorgulari icin PostGIS. lat/lon'dan turetilir, yani tek dogruluk
  -- kaynagi vardir ve PostgREST frontend'e temiz sayilar dondurmeye devam eder.
  geo extensions.geography(Point, 4326) generated always as (
    case
      when latitude is not null and longitude is not null
      then extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
    end
  ) stored,

  website         text,
  google_maps_url text,

  plan                public.business_plan not null default 'free',
  status              public.business_status not null default 'pending',
  verification_status public.verification_status not null default 'unverified',

  -- §20: her kaydin kaynagi izlenebilir olmali.
  source_type      public.source_type not null,
  source_note      text,
  last_verified_at timestamptz,
  verified_by      uuid references public.profiles(id) on delete set null,

  owner_id   uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint businesses_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint businesses_phone_e164_format
    check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  constraint businesses_whatsapp_e164_format
    check (whatsapp_e164 is null or whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  constraint businesses_latitude_range  check (latitude is null or latitude between -90 and 90),
  constraint businesses_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint businesses_coords_paired check (
    (latitude is null and longitude is null) or (latitude is not null and longitude is not null)
  ),
  constraint businesses_website_scheme
    check (website is null or website ~* '^https?://'),
  -- Sahiplenilmis bir isletmenin sahibi olmali; sahipsiz "claimed" durumu tutarsizdir.
  constraint businesses_claimed_needs_owner check (
    verification_status <> 'owner_claimed' or owner_id is not null
  ),
  constraint businesses_claimed_at_needs_owner check (
    claimed_at is null or owner_id is not null
  )
);

comment on table public.businesses is
  'Taksi isletmesi kayitlari. Uydurma isletme/telefon/adres KESINLIKLE eklenmez (§20).';
comment on column public.businesses.phone_e164 is
  'Kanonik E.164 telefon. NULL olabilir: dogrulanmamis numara uydurulmaz, telefonsuz yayinlanir.';
comment on column public.businesses.geo is
  'lat/lon''dan turetilen PostGIS noktasi. "Yakinimdaki taksiler" sorgusu bunu kullanir.';
comment on column public.businesses.source_type is
  'Verinin kaynagi. Guven sinyallerinin ve KVKK izlenebilirliginin temeli.';

-- ---------------------------------------------------------------------------
-- business_slug_history — slug degisiminde 301 (§64)
-- ---------------------------------------------------------------------------
create table public.business_slug_history (
  id          uuid primary key default extensions.gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  old_slug    text not null unique,
  created_at  timestamptz not null default now()
);

comment on table public.business_slug_history is
  'Eski slug -> isletme. Slug degisiminde kalici yonlendirme (301) icin kullanilir.';

-- ---------------------------------------------------------------------------
-- Cok-a-cok iliskiler
-- ---------------------------------------------------------------------------
create table public.business_services (
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id  uuid not null references public.services(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (business_id, service_id)
);

create table public.business_locations (
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  -- Isletmenin bulundugu asil lokasyon mu, yoksa hizmet verdigi bolge mi?
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (business_id, location_id)
);

comment on table public.business_locations is
  'Isletmenin hizmet verdigi bolgeler. is_primary = isletmenin fiziksel konumu.';

-- ---------------------------------------------------------------------------
-- business_hours — calisma saatleri
--
-- ONEMLI: Bu tabloya yalnizca DOGRULANMIS saatler yazilir. Satir yoksa arayuz
-- "calisma saati bilgisi yok" der; varsayilan/tahmini saat UYDURULMAZ (§75).
-- ---------------------------------------------------------------------------
create table public.business_hours (
  id          uuid primary key default extensions.gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  -- 0 = Pazar ... 6 = Cumartesi (ISO yerine JS getDay() ile ayni)
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at    time,
  closes_at   time,
  is_24h      boolean not null default false,
  is_closed   boolean not null default false,
  created_at  timestamptz not null default now(),

  unique (business_id, day_of_week),
  -- 24 saat acik, kapali ve saatli durumlar birbirini disliyor.
  constraint business_hours_consistent check (
    (is_24h and not is_closed and opens_at is null and closes_at is null)
    or (is_closed and not is_24h and opens_at is null and closes_at is null)
    or (not is_24h and not is_closed and opens_at is not null and closes_at is not null)
  )
);

-- ---------------------------------------------------------------------------
-- business_media — Supabase Storage referanslari (§18)
-- ---------------------------------------------------------------------------
create table public.business_media (
  id           uuid primary key default extensions.gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  storage_path text not null unique,
  media_type   public.media_type not null default 'photo',
  alt_text     text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

comment on column public.business_media.alt_text is
  'Erisilebilirlik icin zorunlu pratik: gorseller alt metinsiz yayinlanmamali.';

-- ---------------------------------------------------------------------------
-- claims — profil sahiplenme (§14)
-- ---------------------------------------------------------------------------
create table public.claims (
  id                  uuid primary key default extensions.gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete cascade,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  verification_method public.verification_method not null default 'manual_admin',
  status              public.claim_status not null default 'pending',
  -- Basvuru sirasinda beyan edilen iletisim bilgisi (dogrulama icin).
  contact_phone_e164  text,
  note                text,
  reviewer_note       text,
  submitted_at        timestamptz not null default now(),
  approved_at         timestamptz,
  rejected_at         timestamptz,
  reviewed_by         uuid references public.profiles(id) on delete set null,

  constraint claims_contact_phone_format
    check (contact_phone_e164 is null or contact_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  constraint claims_status_timestamps check (
    (status = 'approved' and approved_at is not null and rejected_at is null)
    or (status = 'rejected' and rejected_at is not null and approved_at is null)
    or (status in ('pending', 'cancelled') and approved_at is null and rejected_at is null)
  )
);

-- Bir isletme yalnizca BIR kez sahiplenilebilir; ikinci onay engellenir.
create unique index claims_one_approved_per_business
  on public.claims (business_id)
  where status = 'approved';

-- Ayni kullanici ayni isletme icin ayni anda birden fazla bekleyen talep acamaz.
create unique index claims_one_pending_per_user_business
  on public.claims (business_id, user_id)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- reviews — V1'de YAZMA KAPALI, sema ileriye donuk hazir (§17)
-- ---------------------------------------------------------------------------
create table public.reviews (
  id          uuid primary key default extensions.gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  rating      smallint not null check (rating between 1 and 5),
  review_text text,
  status      public.review_status not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.reviews is
  'V1''de kullanilmaz. Sahte/dogrulanmamis degerlendirme OLUSTURULMAZ (§17, §75). '
  'aggregateRating structured data''si bu tablo gercek veriyle dolana kadar yazilmaz.';

-- ---------------------------------------------------------------------------
-- landing_pages — SEO landing page tanimlari (§30, §31)
--
-- Sayfalar koda gomulmez; burada tanimlanir. min_business_count esigi, thin
-- content'i bir temenni degil VERITABANI KURALI haline getirir.
-- ---------------------------------------------------------------------------
create table public.landing_pages (
  id          uuid primary key default extensions.gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  h1          text not null,
  intro       text,
  meta_description text,
  location_id uuid references public.locations(id) on delete set null,
  service_id  uuid references public.services(id) on delete set null,
  -- Bu esigin altinda kalan sayfa noindex alir ve sitemap'e girmez.
  min_business_count integer not null default 3,
  is_published       boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint landing_pages_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint landing_pages_min_count_positive check (min_business_count >= 0),
  -- Hicbir hedefi olmayan landing page, tanimi geregi thin content olurdu.
  constraint landing_pages_has_target check (location_id is not null or service_id is not null)
);

comment on column public.landing_pages.min_business_count is
  'Bu sayfaya dusen aktif isletme sayisi bu esigin altindaysa sayfa noindex alir '
  've sitemap''e girmez. Thin content''e karsi yapisal kapi (§31, §75).';

-- ---------------------------------------------------------------------------
-- analytics_events — ham olaylar (§16)
--
-- KVKK: IP, user-agent ve kisisel veri SAKLANMAZ. session_id tarayici oturumuna
-- ozel, kisiyle iliskilendirilemeyen gecici bir kimliktir.
-- ---------------------------------------------------------------------------
create table public.analytics_events (
  id           bigint generated always as identity primary key,
  business_id  uuid references public.businesses(id) on delete cascade,
  event_type   public.analytics_event_type not null,
  session_id   uuid not null,
  -- Sadece host tutulur, tam URL degil: "google.com", "chatgpt.com" gibi.
  referrer_host text,
  landing_path  text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),

  constraint analytics_events_referrer_host_len check (referrer_host is null or length(referrer_host) <= 255),
  constraint analytics_events_landing_path_len  check (landing_path is null or length(landing_path) <= 512),
  -- Serbest metin siserek istismar araci olmasin diye metadata boyutu sinirli.
  constraint analytics_events_metadata_size check (pg_column_size(metadata) <= 2048),
  -- Isletmeye bagli olaylar business_id olmadan anlamsizdir.
  constraint analytics_events_business_required check (
    business_id is not null
    or event_type in ('search_performed', 'listing_submitted')
  )
);

comment on table public.analytics_events is
  'Ham olay kaydi. IP/user-agent/PII TUTULMAZ. 90 gun sonra silinir (§56).';

-- ---------------------------------------------------------------------------
-- analytics_daily — gunluk ozet
--
-- Dashboard ham tabloyu taramaz; bu ozeti okur. Ham olaylar 90 gun sonra
-- silinse de ozet kalici olarak durur.
-- ---------------------------------------------------------------------------
create table public.analytics_daily (
  business_id uuid not null references public.businesses(id) on delete cascade,
  day         date not null,
  event_type  public.analytics_event_type not null,
  event_count integer not null default 0 check (event_count >= 0),
  updated_at  timestamptz not null default now(),
  primary key (business_id, day, event_type)
);

comment on table public.analytics_daily is
  'Gunluk rollup. Panel istatistikleri buradan okunur; ham tablo taranmaz.';
