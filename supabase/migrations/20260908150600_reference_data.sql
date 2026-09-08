-- Kütahya Taksi Ağı — referans verisi
--
-- Bu bir "test seed"i DEGILDIR. Kategoriler, hizmetler ve lokasyonlar uygulamanin
-- calismasi icin gerekli referans verisidir, bu yuzden migration olarak tasinir.
--
-- VERI KAYNAGI ve DOGRULUK (§20, §75):
--   - Ilce listesi: Kütahya ili 13 ilcedir (Merkez + 12). Kamuya acik idari bilgi.
--   - Koordinatlar: OpenStreetMap'ten dogrulanarak alindi (ODbL lisansi).
--     ODbL ATIF GEREKTIRIR -> sitede "© OpenStreetMap katkida bulunanlar"
--     ibaresi gosterilmelidir (Faz 3 footer).
--   - Hicbir koordinat tahmin edilmedi veya uydurulmadi. Dogrulanamayan
--     lokasyonlar (hastaneler) BILEREK eklenmedi; Faz 4'te dogrulanarak eklenecek.
--
-- Isletme (businesses) verisi burada YOKTUR ve olmayacaktir: gercek isletmeler
-- ancak dogrulandiktan sonra elle/basvuruyla girilir.

-- ---------------------------------------------------------------------------
-- Kategori — MVP tek dikey
-- ---------------------------------------------------------------------------
insert into public.categories (slug, name, description) values
  ('taksi', 'Taksi', 'Taksi işletmeleri ve durakları')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Hizmetler (§10)
--
-- Bunlar bizim taksonomimizdir; bir isletmenin bu hizmeti verdigi ancak
-- dogrulandiginda business_services'e yazilir.
-- ---------------------------------------------------------------------------
insert into public.services (slug, name, description, sort_order) values
  ('724-taksi',             '7/24 Taksi',            'Gece gündüz kesintisiz hizmet veren taksiler', 10),
  ('havalimani-transferi',  'Havalimanı Transferi',  'Zafer Havalimanı ve çevre havalimanlarına transfer', 20),
  ('sehirlerarasi-transfer','Şehirlerarası Transfer','Kütahya dışına şehirlerarası taksi hizmeti', 30),
  ('otogar-transferi',      'Otogar Transferi',      'Şehirlerarası otobüs terminaline transfer', 40),
  ('universite-transferi',  'Üniversite Transferi',  'Üniversite yerleşkelerine transfer', 50),
  ('hastane-transferi',     'Hastane Transferi',     'Hastane ve sağlık kuruluşlarına transfer', 60)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Lokasyonlar (§12)
-- ---------------------------------------------------------------------------

-- Il merkezi
insert into public.locations (slug, name, type, latitude, longitude, source_type, source_note) values
  ('kutahya', 'Kütahya', 'city', 39.41991, 29.98579, 'osm', 'OpenStreetMap (ODbL) — place=city')
on conflict (slug) do nothing;

-- Ilceler — Kütahya ili 13 ilce (Merkez dahil)
insert into public.locations (slug, name, type, parent_id, latitude, longitude, source_type, source_note)
select v.slug, v.name, 'district'::public.location_type, c.id, v.lat, v.lon,
       'osm'::public.source_type, 'OpenStreetMap (ODbL) — place=city/town'
from (values
  ('merkez',      'Kütahya Merkez', 39.41991, 29.98579),
  ('altintas',    'Altıntaş',       39.06035, 30.10758),
  ('aslanapa',    'Aslanapa',       39.21522, 29.86963),
  ('cavdarhisar', 'Çavdarhisar',    39.19439, 29.61952),
  ('domanic',     'Domaniç',        39.80140, 29.61185),
  ('dumlupinar',  'Dumlupınar',     38.85436, 29.97764),
  ('emet',        'Emet',           39.34146, 29.25859),
  ('gediz',       'Gediz',          38.98984, 29.39396),
  ('hisarcik',    'Hisarcık',       39.25051, 29.23129),
  ('pazarlar',    'Pazarlar',       38.99463, 29.12312),
  ('simav',       'Simav',          39.08867, 28.98001),
  ('saphane',     'Şaphane',        39.02541, 29.21995),
  ('tavsanli',    'Tavşanlı',       39.54512, 29.49553)
) as v(slug, name, lat, lon)
cross join (select id from public.locations where slug = 'kutahya') c
on conflict (slug) do nothing;

-- Onemli noktalar — yalnizca OSM'de dogrulanabilenler
insert into public.locations (slug, name, type, parent_id, latitude, longitude, source_type, source_note)
select v.slug, v.name, v.ltype::public.location_type, p.id, v.lat, v.lon,
       'osm'::public.source_type, v.note
from (values
  ('zafer-havalimani',
   'Zafer Havalimanı', 'airport', 'altintas', 39.11261, 30.13017,
   'OpenStreetMap (ODbL) — aeroway=aerodrome, IATA: KZR'),
  ('kutahya-otogar',
   'Kütahya Şehirler Arası Otobüs Terminali', 'bus_station', 'merkez', 39.44248, 30.00626,
   'OpenStreetMap (ODbL) — amenity=bus_station'),
  ('dumlupinar-universitesi-evliya-celebi-yerleskesi',
   'Dumlupınar Üniversitesi Evliya Çelebi Yerleşkesi', 'university', 'merkez', 39.48230, 29.89688,
   'OpenStreetMap (ODbL) — amenity=university'),
  ('dumlupinar-universitesi-germiyan-yerleskesi',
   'Dumlupınar Üniversitesi Germiyan Yerleşkesi', 'university', 'merkez', 39.39239, 30.04051,
   'OpenStreetMap (ODbL) — amenity=university')
) as v(slug, name, ltype, parent_slug, lat, lon, note)
join public.locations p on p.slug = v.parent_slug
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Landing page tanimlari (§30)
--
-- Hepsi is_published = false olarak baslar. Bunlar Faz 4'te, sayfa olusturucu
-- yazildiginda ve GERCEK isletme verisi geldiginde acilacak.
--
-- `intro` bilerek bos: icerik, hangi isletmelerin gercekten var oldugu
-- bilinmeden yazilamaz — aksi halde §74'un yasakladigi "AI tarafindan yazilmis
-- gibi duran anlamsiz SEO metni" uretilmis olur.
--
-- min_business_count = 3: bu esigi gecmeyen sayfa noindex alir ve sitemap'e
-- girmez. Thin content'e karsi yapisal kapi (§31).
--
-- NOT: `/kutahya-taksi` BILEREK EKLENMEDI. `/taksi` listesiyle ayni icerigi
-- gosterme riski var; canonical karari Faz 4'te verilecek (ARCHITECTURE.md §8).
-- ---------------------------------------------------------------------------
insert into public.landing_pages (slug, title, h1, location_id, service_id, min_business_count, is_published, sort_order)
select
  v.slug, v.title, v.h1,
  (select id from public.locations where slug = v.location_slug),
  (select id from public.services  where slug = v.service_slug),
  3, false, v.sort_order
from (values
  ('kutahya-724-taksi',
   'Kütahya 7/24 Taksi — Gece Gündüz Açık Taksiler',
   'Kütahya''da 7/24 Açık Taksiler',
   'kutahya', '724-taksi', 10),
  ('kutahya-havalimani-taksi',
   'Kütahya Havalimanı Taksi — Havalimanı Transferi',
   'Kütahya Havalimanı Transferi Yapan Taksiler',
   'kutahya', 'havalimani-transferi', 20),
  ('zafer-havalimani-taksi',
   'Zafer Havalimanı Taksi — Havalimanı Transferi',
   'Zafer Havalimanı''na Transfer Yapan Taksiler',
   'zafer-havalimani', 'havalimani-transferi', 30),
  ('kutahya-sehirlerarasi-taksi',
   'Kütahya Şehirlerarası Taksi',
   'Kütahya''dan Şehirlerarası Taksi Hizmeti',
   'kutahya', 'sehirlerarasi-transfer', 40),
  ('kutahya-otogar-taksi',
   'Kütahya Otogar Taksi — Terminal Transferi',
   'Kütahya Otogarına Transfer Yapan Taksiler',
   'kutahya-otogar', 'otogar-transferi', 50),
  ('kutahya-universite-taksi',
   'Kütahya Üniversite Taksi — Yerleşke Transferi',
   'Üniversite Yerleşkelerine Transfer Yapan Taksiler',
   'kutahya', 'universite-transferi', 60)
) as v(slug, title, h1, location_slug, service_slug, sort_order)
on conflict (slug) do nothing;
