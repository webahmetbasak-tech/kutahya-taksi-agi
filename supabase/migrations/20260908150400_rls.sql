-- Kütahya Taksi Ağı — Row Level Security (§54)
--
-- ILKE: RLS istisnasiz her tabloda aciktir. `anon` anahtar client bundle'a girer,
-- yani guvenlik anahtarin gizliliginde DEGIL, buradaki politikalardadir.
--
-- `(select auth.uid())` sarmalanmis haliyle kullanilir: PostgreSQL bunu satir
-- basina degil sorgu basina bir kez degerlendirir (initplan), bu da buyuk
-- tablolarda ciddi performans farki yaratir.

alter table public.categories            enable row level security;
alter table public.profiles              enable row level security;
alter table public.services              enable row level security;
alter table public.locations             enable row level security;
alter table public.businesses            enable row level security;
alter table public.business_slug_history enable row level security;
alter table public.business_services     enable row level security;
alter table public.business_locations    enable row level security;
alter table public.business_hours        enable row level security;
alter table public.business_media        enable row level security;
alter table public.claims                enable row level security;
alter table public.reviews               enable row level security;
alter table public.landing_pages         enable row level security;
alter table public.analytics_events      enable row level security;
alter table public.analytics_daily       enable row level security;

-- ===========================================================================
-- Referans tablolari — herkes okur, yalnizca admin yazar
-- ===========================================================================

create policy categories_select_all on public.categories
  for select to anon, authenticated using (true);
create policy categories_admin_write on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy services_select_active on public.services
  for select to anon, authenticated using (is_active or public.is_admin());
create policy services_admin_write on public.services
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy locations_select_all on public.locations
  for select to anon, authenticated using (true);
create policy locations_admin_write on public.locations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- profiles
--
-- Kullanici yalnizca KENDI profilini gorur. Baska bir kullanicinin adini/
-- telefonunu okuyamaz — isletme sahiplerinin kisisel bilgileri public degildir.
-- ===========================================================================

create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or public.is_admin());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id or public.is_admin())
  with check ((select auth.uid()) = id or public.is_admin());

-- INSERT yok: profil, auth.users trigger'i ile olusturulur.
-- DELETE yok: kullanici silme auth.users uzerinden cascade eder.

create policy profiles_admin_delete on public.profiles
  for delete to authenticated using (public.is_admin());

-- ===========================================================================
-- businesses — sistemin kalbi
-- ===========================================================================

-- Public YALNIZCA aktif isletmeleri gorur. pending/rejected/archived gorunmez.
create policy businesses_select_active on public.businesses
  for select to anon, authenticated
  using (status = 'active');

-- Sahip kendi kaydini her durumda gorur (ornegin 'suspended' iken bile).
create policy businesses_select_own on public.businesses
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy businesses_select_admin on public.businesses
  for select to authenticated
  using (public.is_admin());

-- Sahip kendi kaydini guncelleyebilir. HANGI KOLONLARI degistiremeyecegi
-- protect_business_admin_columns trigger'inda zorlanir (status, plan,
-- verification_status, owner_id ...). Iki katmanli koruma bilincli.
create policy businesses_update_own on public.businesses
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy businesses_admin_all on public.businesses
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Isletme ekleme (§26) Faz 8'de kontrollu bir RPC uzerinden yapilacak.
-- Dogrudan INSERT policy'si BILEREK verilmiyor: anon'a serbest insert vermek
-- rehberi spam'e acardi.

-- ===========================================================================
-- business_slug_history — 301 yonlendirmesi icin public okuma
-- ===========================================================================

create policy slug_history_select_all on public.business_slug_history
  for select to anon, authenticated using (true);
create policy slug_history_admin_write on public.business_slug_history
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- Isletme alt tablolari
--
-- Gorunurluk her zaman bagli oldugu isletmenin gorunurlugunu takip eder:
-- pending bir isletmenin fotograflari da hizmetleri de public degildir.
-- ===========================================================================

create policy business_services_select on public.business_services
  for select to anon, authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id
      and (b.status = 'active' or b.owner_id = (select auth.uid()) or public.is_admin())
  ));

create policy business_services_owner_write on public.business_services
  for all to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and (b.owner_id = (select auth.uid()) or public.is_admin())
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = business_id and (b.owner_id = (select auth.uid()) or public.is_admin())
  ));

create policy business_locations_select on public.business_locations
  for select to anon, authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id
      and (b.status = 'active' or b.owner_id = (select auth.uid()) or public.is_admin())
  ));

create policy business_locations_owner_write on public.business_locations
  for all to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and (b.owner_id = (select auth.uid()) or public.is_admin())
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = business_id and (b.owner_id = (select auth.uid()) or public.is_admin())
  ));

create policy business_hours_select on public.business_hours
  for select to anon, authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id
      and (b.status = 'active' or b.owner_id = (select auth.uid()) or public.is_admin())
  ));

create policy business_hours_owner_write on public.business_hours
  for all to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and (b.owner_id = (select auth.uid()) or public.is_admin())
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = business_id and (b.owner_id = (select auth.uid()) or public.is_admin())
  ));

create policy business_media_select on public.business_media
  for select to anon, authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id
      and (b.status = 'active' or b.owner_id = (select auth.uid()) or public.is_admin())
  ));

create policy business_media_owner_write on public.business_media
  for all to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and (b.owner_id = (select auth.uid()) or public.is_admin())
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = business_id and (b.owner_id = (select auth.uid()) or public.is_admin())
  ));

-- ===========================================================================
-- claims — sahiplenme talepleri
--
-- Kullanici yalnizca KENDI talebini gorur. Baska birinin bir isletmeyi
-- sahiplenmeye calistigini goremez.
-- ===========================================================================

create policy claims_select_own on public.claims
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

create policy claims_insert_own on public.claims
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    -- Talep yalnizca gorunur bir isletme icin acilabilir.
    and exists (select 1 from public.businesses b where b.id = business_id and b.status = 'active')
    -- Zaten sahibi olan isletme sahiplenilemez.
    and not exists (select 1 from public.businesses b where b.id = business_id and b.owner_id is not null)
    -- Basvuru daima 'pending' baslar; kullanici kendini onaylayamaz.
    and status = 'pending'
    and approved_at is null
    and rejected_at is null
    and reviewed_by is null
  );

-- Kullanici yalnizca kendi BEKLEYEN talebini iptal edebilir. Onaylama/reddetme
-- yetkisi yok: WITH CHECK yalnizca 'cancelled' hedefine izin verir.
create policy claims_cancel_own on public.claims
  for update to authenticated
  using ((select auth.uid()) = user_id and status = 'pending')
  with check ((select auth.uid()) = user_id and status = 'cancelled');

create policy claims_admin_all on public.claims
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- reviews — V1'de YAZMA KAPALI (§17)
--
-- Yalnizca onaylanmis degerlendirmeler okunur. INSERT policy'si BILEREK YOK:
-- dogrulanmamis degerlendirme sistemi V1'de acilmayacak.
-- ===========================================================================

create policy reviews_select_approved on public.reviews
  for select to anon, authenticated
  using (status = 'approved' or public.is_admin());

create policy reviews_admin_all on public.reviews
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- landing_pages
-- ===========================================================================

create policy landing_pages_select_published on public.landing_pages
  for select to anon, authenticated
  using (is_published or public.is_admin());

create policy landing_pages_admin_write on public.landing_pages
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- analytics_events
--
-- Bu tablo tasarimin en hassas noktasi: anon INSERT gerekiyor (olcum tarayicida
-- yapiliyor) ama bu istismara aciktir (R5).
--
-- Savunma katmanlari:
--   1. SELECT YOK — hicbir public kullanici veriyi okuyamaz. Rakip bir
--      isletmenin istatistigi gorulemez, tablo veri sizdirma yuzeyi olmaz.
--   2. UPDATE/DELETE YOK — kayitlar degistirilemez.
--   3. WITH CHECK: yalnizca AKTIF bir isletme icin olay yazilabilir.
--   4. Kolon kisitlari (metadata boyutu, uzunluklar) tabloda tanimli.
--   5. Zaman damgasi client'tan alinmaz (default now()).
-- ===========================================================================

create policy analytics_events_insert on public.analytics_events
  for insert to anon, authenticated
  with check (
    business_id is null
    or exists (
      select 1 from public.businesses b
      where b.id = business_id and b.status = 'active'
    )
  );

create policy analytics_events_admin_select on public.analytics_events
  for select to authenticated
  using (public.is_admin());

-- ===========================================================================
-- analytics_daily — panel istatistikleri
--
-- Isletme sahibi YALNIZCA kendi isletmesinin sayilarini gorur.
-- Yazma yalnizca rollup fonksiyonuyla (SECURITY DEFINER) yapilir.
-- ===========================================================================

create policy analytics_daily_select_own on public.analytics_daily
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = (select auth.uid())
    )
  );

-- ===========================================================================
-- Varsayilan yetkilerin daraltilmasi
--
-- Supabase anon/authenticated rollerine public sema uzerinde genis GRANT verir.
-- RLS zaten satirlari korur; yine de yazma yetkisini gereksiz genis birakmiyoruz.
-- ===========================================================================

revoke all on public.analytics_events from anon, authenticated;
grant insert on public.analytics_events to anon, authenticated;
grant select on public.analytics_events to authenticated;

revoke all on public.analytics_daily from anon, authenticated;
grant select on public.analytics_daily to authenticated;

revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated; -- RLS admin'e daraltir

revoke insert, update, delete on public.categories from anon;
revoke insert, update, delete on public.services from anon;
revoke insert, update, delete on public.locations from anon;
revoke insert, update, delete on public.businesses from anon;
revoke insert, update, delete on public.landing_pages from anon;
revoke insert, update, delete on public.business_slug_history from anon;
revoke insert, update, delete on public.business_services from anon;
revoke insert, update, delete on public.business_locations from anon;
revoke insert, update, delete on public.business_hours from anon;
revoke insert, update, delete on public.business_media from anon;
revoke all on public.profiles from anon;
revoke all on public.claims from anon;
