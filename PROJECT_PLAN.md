# PROJECT_PLAN.md — Kütahya Taksi Ağı

> Durum: **FAZ 4 tamamlandı.** Sıradaki: FAZ 5 — GEO / AI Search Layer.
> Son güncelleme: 9 Eylül 2026

Mimari kararlar ve gerekçeleri için: [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 1. MVP Tanımı

**Müşteri** "Kütahya taksi" arar → siteyi bulur → taksileri listeler → bir profili açar →
tek tıkla arar / WhatsApp'a geçer / yol tarifi alır.

**Taksici** kendi işletmesini arar → profilini bulur → "Profilimi Sahiplen" der → doğrular →
bilgilerini yönetir → kaç kişinin görüntülediğini ve tıkladığını görür.

MVP'de **olmayanlar** (§2): dispatch, sürücü uygulaması, gerçek zamanlı konum, eşleştirme,
online ödeme, yolculuk takibi, komisyon, zorunlu müşteri hesabı.

---

## 2. FAZ 0 — Discovery Çıktısı

### Yapılanlar

- Repository analizi: `C:\dev\taxi43` **boş** — greenfield.
- Toolchain doğrulaması: Node 24.18.0, npm 11.17.0, Angular CLI 22.0.6, git 2.55.0.
  Supabase CLI ve Vercel CLI **kurulu değil**.
- npm registry doğrulaması: `@angular/core` 22.1.5, `@angular/ssr` 22.1.7,
  `@supabase/supabase-js` 2.116.0.
- Vercel + Angular SSR deployment durumu araştırıldı (zero-config **yok**, adapter gerekli).
- Angular 22 SSR API'si doğrulandı (`provideServerRendering(withRoutes(...))`, `RenderMode`,
  `outputMode`, `getPrerenderParams`).
- AI crawler / robots.txt güncel durumu araştırıldı.
- **Kütahya için gerçek taksi verisi mevcudiyeti ölçüldü** (aşağıda — en önemli bulgu).
- git repo `main` branch'i ile init edildi.
- `ARCHITECTURE.md` ve `PROJECT_PLAN.md` yazıldı.

### En önemli bulgu — veri var mı? (ölçüldü, tahmin edilmedi)

OpenStreetMap Overpass API üzerinden Kütahya ili sınırlarında `amenity=taxi` sorgulandı
(ODbL lisanslı, ticari kullanıma ve yeniden yayına açık kaynak — atıf şartıyla):

|                                     | Sayı  |
| ----------------------------------- | ----- |
| Kütahya ilinde kayıtlı taksi durağı | **8** |
| Bunlardan isimli olan               | 6     |
| Bunlardan **telefon numarası olan** | **1** |

Bulunanlar: İstasyon Taksi, Kent Taksi, Özen Taksi, Pembe Taksi, Sera Taksi
(tek telefonlu kayıt), Cumhuriyet Taksi, +2 isimsiz durak.

**Bunun anlamı:** Bu ürünün tek satılık değeri **doğru telefon numarasıdır** ve
serbestçe kullanılabilir açık kaynaklarda o veri **pratik olarak yok**. Kod bu projenin
darboğazı değil — **veri toplama darboğazdır.** Bkz. Risk R1.

---

## 3. Riskler

### R1 — Gerçek veri yok (KRİTİK, projenin gerçek darboğazı)

Yukarıdaki ölçüm: 8 durak, 1 telefon. Prompt §20 uydurma işletme/telefon/adres/çalışma saati
yasağı koyuyor ve buna **harfiyen uyulacak**. Google Maps verisini çekmek ToS ihlalidir ve
yeniden yayın hakkı vermez — bu yol **kapalıdır** (§75).

**Meşru veri yolları (öncelik sırasıyla):**

1. **Saha çalışması** — durakların kendi levhalarındaki numaralar kamuya açık şekilde
   ilan edilmiştir; fotoğraflanır, `source_type='public_business_listing'`,
   `source_note` = fotoğraf referansı, `last_verified_at` = tarih.
2. **Kütahya Şoförler ve Otomobilciler Esnaf Odası** — resmî üye/durak listesi talebi.
3. **Kütahya Belediyesi** — ruhsatlı taksi durakları listesi / açık veri talebi.
4. **İşletme sahibi beyanı** — `/isletme-ekle` formu (Faz 8), `source_type='owner_submitted'`.
5. **OSM seed** — isim + koordinat için (`source_type='osm'`, ODbL atfı ile); telefon **yok**.

**Karar:** Faz 3 (public site) veri olmadan da yazılabilir — ama **yayına çıkış**,
telefonu doğrulanmış **en az 10–15 gerçek işletme** olmadan yapılmayacak. Aksi halde site
"boş dizin" olur; hem kullanıcıya değersizdir hem Google'da düşük kaliteli olarak
değerlendirilir. Veri toplama Faz 1 ile **paralel** başlamalıdır.

### R2 — KVKK / kişisel veri (YÜKSEK)

Şahıs taksicisinin cep numarası kişisel veridir; kamuya açık olması işlemeyi otomatik meşru
kılmaz. Asgari önlemler ARCHITECTURE.md §12'de. **Yayına çıkmadan hukuki inceleme gerekir.**
Bu bir hukuki görüş değildir.

### R3 — Vercel + Angular SSR adapter (ORTA)

Zero-config yok; `api/index.mjs` + `vercel.json` gerekli, aksi halde "SSR açık ama çalışmıyor"
sessiz hatası oluşur — ve bu tam olarak SEO'yu öldüren hatadır.
**Azaltma:** Faz 1 sonunda gerçek Vercel deploy'u ile `curl` üzerinden SSR kanıtlanacak.

### R4 — Thin content (ORTA)

10 işletmeyle 10 landing page üretmek §31/§75 ihlalidir.
**Azaltma:** `landing_pages.min_business_count` (varsayılan 3) — eşiği geçmeyen sayfa
`noindex` alır ve sitemap'e girmez. Yapısal kural, temenni değil.

### R5 — Analytics endpoint istismarı (ORTA)

anon insert açık. Azaltma ARCHITECTURE.md §7'de; kötüye kullanımda Faz 11'de Edge Function.

### R6 — Telefon doğrulama maliyeti (DÜŞÜK-ORTA)

Claim akışında SMS OTP ücretlidir ve Supabase için harici SMS sağlayıcı gerekir.
**Azaltma:** Faz 7'de varsayılan yöntem **`manual_admin`** (admin işletmeyi arar, doğrular).
Hacim büyürse `phone_otp` eklenir. Şema her iki yöntemi de destekliyor.

### R7 — Tek şehir, küçük pazar (KABUL EDİLDİ)

Kütahya'da toplam taksi durağı sayısı muhtemelen 30–60 bandında. Bu bilinçli bir beachhead
kararıdır (§80, §81) — mimari `categories` ve `locations` ile şehir/dikey genişlemeye hazır.

### R8 — Sıralama garantisi yok (İLETİŞİM RİSKİ)

Google/ChatGPT/Gemini'de sıralama garantisi **verilmeyecek** (§73, §77). Taksiciye yönelik
tüm metinler bu kurala göre yazılacak ve Faz 11'de metin denetimi yapılacak.

---

## 4. Faz Planı

Her fazın **Definition of Done**'ı var. DoD sağlanmadan sonraki faza geçilmez.

### FAZ 1 — Project Foundation ✅ TAMAMLANDI

Angular 22 workspace (SSR açık, zoneless), feature klasör iskeleti, routing, environment
üretim script'i, design token'lar, global error handler, loading/skeleton/empty-state,
404 sayfası, ESLint + Prettier, Vercel adapter.

**DoD durumu:**

| Kriter                      | Durum                                                     |
| --------------------------- | --------------------------------------------------------- |
| `npm run build` temiz       | ✅ initial **84.21 kB gzip** (bütçe 120 kB)               |
| Lint temiz                  | ✅                                                        |
| Testler                     | ✅ 11/11                                                  |
| 404 gerçek HTTP 404 dönüyor | ✅                                                        |
| **SSR kanıtı (R3)**         | ✅ **lokal** — rastgele slug istek anında render ediliyor |
| Vercel'de canlı URL         | ⏳ hesap/domain bağlandığında                             |

**SSR kanıtı nasıl alındı:** `curl /taksi/deneme-slug-12345` sunucu HTML'inde slug'ı
döndürdü. Prerender edilmiş bir sayfa bunu üretemez, dolayısıyla SSR istek anında
çalışıyor. Ayrıca `/panel` sunucu HTML'inde **yok** (Client mode doğru), `/hakkinda` ve
`/gizlilik` build'de prerender edildi, public sayfalar `s-maxage=300` header'ı taşıyor.

**Faz 1'de ortaya çıkan yeni bulgu — `allowedHosts` (R3'e ek):** Angular SSR, SSRF
korumasıyla tanınmayan hostname için **tüm sayfalarda 400** döner ve varsayılan liste
boştur. İlk lokal testte site komple 400 verdi. `src/server.ts` artık host listesini
`NG_ALLOWED_HOSTS` + Vercel'in otomatik değişkenlerinden toplar. **Özel domain
bağlandığında `NG_ALLOWED_HOSTS` tanımlanmazsa site tamamen erişilemez olur** —
Faz 12 kontrol listesine eklendi.

### FAZ 2 — Supabase Foundation ✅ TAMAMLANDI

Proje: **kutahyataksi** (`ierfpvxzknfoyubpnzws`, eu-west-1, Postgres 17.6). CLI ile linklendi,
7 migration `db push` ile temiz uygulandı. Tablolar/enum/index/FK/trigger/RLS/Storage/referans
verisi hepsi migration olarak `supabase/migrations/`'da — elle panelden tıklanan hiçbir şey yok.

**DoD durumu:**

| Kriter                                                          | Durum                                                          |
| --------------------------------------------------------------- | -------------------------------------------------------------- |
| Migration'lar sıfırdan temiz uygulanıyor                        | ✅ 7/7, `supabase db push`                                     |
| RLS testleri geçiyor                                            | ✅ **19/19** anon testi (`npm run db:test-rls`)                |
| Storage policy'leri var                                         | ✅ yazıldı, uygulandı — **testi Faz 3'te fotoğraf yüklenince** |
| Fixture testleri (pending/suspended görünürlük, kısıt testleri) | ⏳ `SUPABASE_SERVICE_ROLE_KEY` bekliyor                        |

**Uygulanan şema:**

- Enum'lar: `business_status`, `verification_status`, `source_type`, `location_type`,
  `claim_status`, `verification_method`, `user_role`, `review_status`, `media_type`,
  `business_plan`, `analytics_event_type`.
- Tablolar: `categories`, `profiles`, `services`, `locations`, `businesses`,
  `business_slug_history`, `business_services`, `business_locations`, `business_hours`,
  `business_media`, `claims`, `reviews`, `landing_pages`, `analytics_events`, `analytics_daily`.
- Fonksiyonlar: `is_admin()` (RLS özyinelemesini kırar), `normalize_name()` (duplicate tespiti),
  `normalize_tr_phone()` (§53 — tanınmayan biçimde NULL döner, uydurmaz), `set_updated_at()`,
  `handle_new_user()` (auth.users → profiles), `protect_profile_role()`,
  `protect_business_admin_columns()` (owner `status`/`plan`/`verification_status`/`owner_id`
  değiştiremez — RLS'e ek ikinci katman), `record_business_slug_change()` (§64),
  `apply_approved_claim()` (claim onayı → owner_id + verification_status tek işlemde),
  `rollup_analytics_daily()`, `prune_analytics_events()` (90 gün, §56).
- View: `landing_page_stats` — gerçek aktif işletme sayısını hesaplar, eşiğin altındaki sayfa
  `is_indexable=false` döner (§31 thin content kapısı, yapısal — kod değil veritabanı kuralı).
- Storage: `business-media` bucket (public read, 5MB, yalnızca resim), owner-scoped yazma.

**RLS testleri neyi kanıtladı (`scripts/rls-test.mjs`, 19/19 anon):** anon referans veriyi
okuyabiliyor; profiles/claims/analytics_events/analytics_daily'yi **okuyamıyor**; hiçbir tabloya
doğrudan insert/update/delete **yapamıyor**; analytics event'i yalnızca **aktif** işletme için
ve yalnızca **tanımlı** `event_type` ile yazabiliyor ama yazdığını **geri okuyamıyor**.

**Uygulama katmanı da bu fazda kuruldu** (ARCHITECTURE.md §4 kararının kod karşılığı):
`core/data/postgrest.client.ts` (`HttpClient` üzerinden PostgREST — `supabase-js` public
yolda kullanılmıyor), `business.repository.ts`, `location.repository.ts`,
`service.repository.ts`, Supabase CLI'dan üretilen `database.types.ts`
(`npm run db:types`) ve ondan türetilen `models.ts`. 6 yeni test (17/17 toplam).

**Referans verisi (migration, "test seed'i" değil):** 1 kategori (taksi), 6 hizmet, 1 il +
13 ilçe + 4 önemli nokta (Zafer Havalimanı/IATA KZR, otogar, 2 üniversite yerleşkesi) — hepsi
OpenStreetMap'ten (ODbL) doğrulandı, hiçbir koordinat tahmin edilmedi. 6 landing page tanımı
`is_published=false` ile eklendi; içerik gerçek işletme verisi olmadan yazılmadı (§74).
**`/kutahya-taksi` bilerek eklenmedi** — `/taksi` ile canonical çakışması riski, karar Faz 4'te.

**Faz 2'de ortaya çıkan bulgu — anon anahtar biçimi değişmiş:** Supabase artık yeni
`sb_publishable_...` / `sb_secret_...` formatını kullanıyor (eski JWT tabanlı `anon`/
`service_role` yerine). `generate-env.mjs`'deki gizli-anahtar-sızıntısı koruması hem eski
hem yeni formatı tanıyacak şekilde güncellendi.

**Açık kalan:** `SUPABASE_SERVICE_ROLE_KEY` henüz verilmedi, bu yüzden fixture testleri
(pending/suspended işletmenin gerçekten gizlendiğinin uçtan uca kanıtı, slug/telefon format
kısıtlarının reddedildiğinin kanıtı) **atlandı** — script bunu sessizce "geçti" demek yerine
açıkça "atlandı" olarak raporluyor. Anahtar verilince `npm run db:test-rls` ile tamamlanacak.

### FAZ 3 — Public Website ✅ TAMAMLANDI

Ana sayfa, `/taksi` listesi, `/taksi/:slug` detay, `/bolge` + `/bolge/:slug`, `/hizmet` +
`/hizmet/:slug`, taksi kartı (Ara/WhatsApp/Yol Tarifi), "Yakınımdaki Taksiler" (§49, PostGIS RPC),
mobile-first responsive, boş-durum ekranları — hepsi gerçek Supabase verisine bağlı.

**DoD durumu:**

| Kriter                                    | Durum                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| Tüm sayfalar SSR'da veriyle geliyor       | ✅ 15 noktalı smoke test, gerçek Supabase'e karşı                            |
| Telefon `tel:` çalışıyor                  | ✅                                                                           |
| WhatsApp yalnızca `whatsapp_e164` doluysa | ✅ testle kanıtlandı                                                         |
| a11y                                      | kısmi — semantik HTML/landmark/odak yönetimi var, tam AXE taraması Faz 11'de |
| Gerçek mobil cihaz testi                  | ⏳ Faz 11'de (henüz canlı deployment yok)                                    |

**Yeni:** `/taksi/:slug`, `/bolge/:slug`, `/hizmet/:slug` bulunamayan kayıtlarda **gerçek HTTP
404** dönüyor — `RESPONSE_INIT` injection token'ı (Angular 22, yalnızca SSR'da mevcut) ile.
Bu iddia `taxi-detail-page.spec.ts`'te HttpTestingController ile uçtan uca kanıtlandı: boş
PostgREST yanıtı sonrası `responseInit.status === 404` doğrulandı — kod okuyarak değil, davranış
gözlemlenerek.

**Henüz eklenmeyenler (bilinçli):**

- `/kutahya-taksi` gibi SEO landing page'leri — canonical kararı netleşmeden açılmayacak (Faz 4).
- "7/24 taksiler / Havalimanı transferi / Şehirlerarası taksi" ayrı ayrı ana sayfa bölümleri —
  0 aktif işletmeyle üç neredeyse boş bölüm göstermek gerçek içerik değil doldurma olurdu (§75
  ruhu). Tek "Hizmetler" bölümü hepsine bağlanıyor; işletme sayısı arttıkça Faz 4'te ayrılabilir.
- "Yerel rehber" (§22) — gerçek araştırılmış içerik gerektirir, uydurulmaz (§74).

### KRİTİK BULGU — Angular'ın yerleşik TransferState özelliği bu Angular sürümünde bozuk

Faz 2'nin mimari kararı ("`supabase-js` yerine `HttpClient`, çünkü TransferState'i bedava
kullanırız") test edilince **gerçekte çalışmadığı** ortaya çıktı. Kök neden derlenmiş
`@angular/platform-server` 22.1.5 kaynağı okunarak doğrulandı: `ngServerMode` bayrağını
`true` yapması gereken kod hem `platformServer()` hem `@angular/ssr`'ın `provideServerRendering`'i
içinde **ölü kod** olarak derleniyor — bu satırları kullanan her Angular 22.1.5 SSR uygulamasını
etkileyen, projeye özgü olmayan bir regresyon. Detay: ARCHITECTURE.md §4.

**Çözüm uygulandı:** `postgrest.client.ts` artık Angular'ın `TransferState` API'sini elle
kullanıyor (kendi metotları içinde, genel bir interceptor değil). `curl` ile SSR HTML'inde
gerçek veri görüldü, iki birim testle (sunucu yazıyor / tarayıcı okuyup siliyor, hiç HTTP
isteği yapmadan) kanıtlandı. Bu, Faz 1'deki `allowedHosts` bulgusuyla aynı kategoride bir
"kontrol edilmeden varsayılmasın" dersi — mimari dokümanda yazılı bir iddia, gerçek bir SSR
sunucusuna karşı `curl` ve `ng-state` incelemesiyle doğrulanana kadar kanıtlanmış sayılmadı.

### FAZ 4 — SEO Engine ✅ TAMAMLANDI

`SeoService`, JSON-LD üreticileri (breadcrumb/itemlist/localbusiness/organization/website),
`Breadcrumb` bileşeni, dinamik `sitemap.xml`, ortam-duyarlı `robots.txt`, canonical politikası
kesinleşti, `business_slug_history` → 301, arşiv → 410, `landing_pages` sayfa render'ı,
internal linking (breadcrumb + ItemList URL'leri).

**DoD durumu:**

| Kriter                                                  | Durum                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Her sayfa title/description/canonical/OG/robots taşıyor | ✅ 13 sayfa `SeoService.setPage()` çağırıyor                                               |
| JSON-LD, HTML'de görünmeyen bilgi içermiyor             | ✅ builders.ts testleriyle kanıtlandı (telefon/adres/saat yoksa alan hiç yazılmıyor)       |
| sitemap yalnızca indexable URL içeriyor                 | ✅ `/panel`, `/isletme-ekle` yok; landing page'ler yalnızca `is_indexable=true` iken girer |
| preview/dev ortamı `Disallow: /` veriyor                | ✅ hem `robots.txt` hem `<meta name="robots">` seviyesinde (iki bağımsız güvenlik ağı)     |
| 301/410/404 ayrımı gerçek HTTP durumuyla çalışıyor      | ✅ `resolve_missing_business_slug` RPC + `RESPONSE_INIT`, birim testle kanıtlandı          |
| Gerçek 404 sayfası tüm bulunamadı durumlarında tutarlı  | ✅ (aşağıdaki bulguya bakın)                                                               |

**Canonical kararı kesinleşti:** Her landing page kendi URL'sine self-canonical'dır; `/taksi`'ye
301 verilmez. Gerekçe ve ayrıntı: ARCHITECTURE.md §8. `/kutahya-taksi` gibi `/taksi` ile
GERÇEKTEN örtüşebilecek genel bir sayfa seed'e bilerek eklenmedi.

**301/410/404 nasıl çözülüyor:** `resolve_missing_business_slug(target_slug)` SQL fonksiyonu
(SECURITY DEFINER, Faz 4 migration'ı) `bySlug()` `null` döndükten SONRA çağrılır ve TEK sorguda
üç durumu ayırt eder: slug taşınmış + hedef hâlâ aktifse `redirect` (`taxi-detail-page.ts`
`RESPONSE_INIT.status=301` + `headers.Location` yazar), işletme `archived` ise `410`, hiçbiri
değilse `not_found` → `404`. Fonksiyon yalnızca sınıflandırma döner, işletme verisi sızdırmaz —
`is_admin()` ile aynı SECURITY DEFINER gerekçesi. `taxi-detail-page.spec.ts` dört senaryoyu da
(bulundu/redirect/archived/not_found) `HttpTestingController` ile uçtan uca kanıtlıyor.

### Faz 4'te bulunan ve düzeltilen gerçek hatalar

**1. `:slug` route'u gerçek 404 sayfasını gölgeliyordu.** `landing_pages` sayfalarını yakalamak
için eklenen `:slug` route'u (tüm sabit route'lardan sonra, `**`'den önce) tek segmentli HER
path'i yakalıyor — bu da rastgele bir URL'nin (`/olmayan-999`) asla gerçek `**` wildcard'ına
(markalı `NotFoundPage`) düşmediği, bunun yerine `LandingPage`'in kendi sade "bulunamadı" metnini
gösterdiği anlamına geliyordu. `curl` ile karşılaştırmalı test edilerek yakalandı. Çözüm:
`LandingPage`'in bulunamadı dalı artık `<app-not-found-page>`'i doğrudan yeniden kullanıyor —
kullanıcı her zaman aynı, markalı 404'ü görüyor; HTTP durumu yine `LandingPage`'in kendi
`RESPONSE_INIT` mantığından geliyor (`NotFoundPage` durum kodu ayarlamaz).

**2. Angular'ın yerleşik `withHttpTransferCacheOptions`'ı bu sürümde hiç çalışmıyordu.**
Bu, Faz 3'te bulundu ve orada elle `TransferState` ile çözüldü; Faz 4'te
`includeRequestsWithAuthHeaders: true` eklendi (upstream düzeltildiğinde ikinci bir koruma
katmanı olarak). Ayrıntı: PROJECT_PLAN.md Faz 3 notu, ARCHITECTURE.md §4.

**Açık kalan:** JSON-LD çıktısı harici bir schema.org/Rich Results doğrulayıcısına henüz
gönderilmedi (canlı bir URL gerektiriyor, henüz yok — Faz 12'de Search Console kurulumuyla
birlikte yapılacak). Kod tarafında yapı doğru (testlerle kanıtlandı) ama üçüncü parti
doğrulama bekliyor.

### FAZ 5 — GEO / AI Search Layer

`/llms.txt`, entity ilişkileri, veriye dayalı güven sinyalleri, AI crawler politikasının
güncel resmî dokümantasyonla doğrulanması.

**DoD:** JS kapalıyken tüm kritik bilgi HTML'de · `llms.txt` yalnızca aktif/indexable URL
listeliyor · hiçbir güven rozeti veriden bağımsız/sabit değil.

### FAZ 6 — Analytics

Event tracking servisi, `sendBeacon`, bot filtresi, session id, `analytics_daily` rollup +
`pg_cron`, 90 günlük saklama, dashboard istatistik sorguları.

**DoD:** 8 event tipi de kaydediliyor · SSR event üretmiyor · rollup doğru sayıyor ·
90 gün temizliği çalışıyor · kayıtlarda PII yok.

### FAZ 7 — Claim Flow

"Bu işletme size mi ait?" → auth → doğrulama (`manual_admin`) → claim → admin review →
owner dashboard. `claim_started` / `claim_completed` event'leri.

**DoD:** bir işletme iki kez sahiplenilemez · reddedilen claim tekrar denenebilir ·
owner yalnızca izinli kolonları güncelleyebiliyor (RLS testi) · e2e akış testi geçiyor.

### FAZ 8 — Business Submission

`/isletme-ekle` formu, doğrulama, telefon normalizasyonu, duplicate tespiti (§52 — otomatik
silme yok, admin'e işaretlenir), fotoğraf upload, `pending` → admin onayı → `active`.

**DoD:** geçersiz telefon reddediliyor · duplicate uyarısı çalışıyor · pending kayıt public'te
görünmüyor · onay sonrası profil canlı ve sitemap'e giriyor.

### FAZ 9 — Admin Panel

İşletme CRUD, claim inceleme, kullanıcı yönetimi, hizmet/lokasyon yönetimi, review moderasyonu,
analytics görüntüleme, hızlı veri girişi formu (§51), profil kaldırma talebi kuyruğu (KVKK).

**DoD:** admin olmayan `/admin`'e erişemiyor (guard + RLS, iki katman) · tüm CRUD çalışıyor ·
admin işlemleri denetlenebilir (`verified_by`, `reviewed_by` doluyor).

### FAZ 10 — Premium Foundation

`plan` alanı, feature flag altyapısı, abonelik-hazır şema. **Ödeme entegrasyonu yok** —
gerçekten gerekli olduğunda eklenir.

**DoD:** flag'ler çalışıyor · hiçbir premium özellik sıralama garantisi vaat etmiyor (§58).

### FAZ 11 — Production Hardening

RLS denetimi, secret taraması, performans (Core Web Vitals bütçesi), SEO denetimi, a11y,
mobil QA, 404/301/410 denetimi, hata durumları, analytics doğrulaması, **metin denetimi (R8)**,
KVKK metinleri.

**DoD:** performans bütçesi tutuyor · bundle'da secret yok · tüm §62 checklist'i geçiyor ·
garanti vaat eden metin yok.

### FAZ 12 — Deployment

Vercel production, Supabase production, domain + DNS + SSL, robots/sitemap doğrulaması,
Search Console, monitoring, smoke test.

**Domain bağlanınca yapılacak zorunlu ayarlar:**

1. `SITE_URL` = gerçek domain (boşsa production build **durur**)
2. `NG_ALLOWED_HOSTS` = `domain.com,www.domain.com` (**eksikse site komple 400 döner**)
3. `ENVIRONMENT=production` (otomatik `noindex`'i kaldırır)
4. `SUPABASE_URL` + `SUPABASE_ANON_KEY`

**DoD:** domain canlı ve HTTPS · `curl` ile SSR kanıtı production'da tekrarlandı ·
`noindex` kalktı · sitemap Search Console'a gönderildi · production smoke test geçti ·
gerçek bir telefon tıklaması analytics'te görünüyor.

---

## 5. Uygulama Sırası ve Bağımlılıklar

```
FAZ 1 ──> FAZ 2 ──> FAZ 3 ──> FAZ 4 ──> FAZ 5
                       │         │
                       └──> FAZ 6 ──> FAZ 7 ──> FAZ 8 ──> FAZ 9 ──> FAZ 10
                                                                       │
                                                              FAZ 11 ──> FAZ 12

PARALEL (Faz 1'den itibaren, kod dışı):  VERİ TOPLAMA  ← projenin gerçek kritik yolu
```

**Vurgulanan nokta:** Faz 1–12 tamamlanmış bir site, gerçek telefon numaraları olmadan
değersizdir. Veri toplama kodla paralel yürümezse proje "çalışan ama boş" biter.

---

## 6. KPI (§78)

Trafikten önceki asıl hedef: **gerçek müşteri → gerçek taksici bağlantısı.**

İlk ölçülecekler: indexed pages, organic impressions/clicks, profile views, call clicks,
WhatsApp clicks, directions clicks, claimed businesses, submitted businesses,
verified businesses, geri dönen işletme sahipleri.

---

## 7. Açık Sorular (kararı proje sahibine ait)

1. **Veri toplama** — saha çalışmasını kim yapacak, ne zaman başlıyor? (R1, kritik yol)
2. **Esnaf Odası / Belediye** — resmî liste talebi için temas kurulabilir mi?
3. **Domain** — alınınca `SITE_URL` doldurulacak; Faz 12 buna bağlı.
4. **Eğitim amaçlı AI crawler'ları** (`GPTBot`, `CCBot`, `Google-Extended`) allow mu kalsın?
   Varsayılan planım: **allow** (hedef görünürlük). Farklı isterseniz Faz 5'te değiştirilir.
5. **KVKK hukuki inceleme** — yayın öncesi kim yapacak? (R2)

Bu soruların hiçbiri FAZ 1'i bloklamıyor; FAZ 1'e devam ediliyor.

---

## 8. Sonraki Adım

**FAZ 1 — Project Foundation.** Angular 22 workspace kurulumu, feature iskeleti, design
token'lar, ilk Vercel deploy ve SSR kanıtı (R3).
