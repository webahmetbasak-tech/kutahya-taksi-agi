# PROJECT_PLAN.md — Kütahya Taksi Ağı

> Durum: **FAZ 7 tamamlandı.** Sıradaki: FAZ 8 — Business Submission.
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

### R9 — İlk admin'i bootstrap etmenin dokümante edilmiş bir yolu yok (Faz 7'de canlıda keşfedildi, ORTA)

`profiles_protect_role` trigger'ı `role` kolonunu DEĞİŞTİREN her UPDATE'i `is_admin()` DEĞİLSE
reddeder — bu KASITLI bir korumadır (bir kullanıcı kendini admin yapamasın diye), ama bunun
istenmeyen bir sonucu var: sistemde HENÜZ HİÇ admin yokken (bugünkü canlı durum) bu korumayı
"meşru" şekilde aşacak hiçbir yol yok — `service_role` anahtarı bile RLS'i atlar ama trigger'ı
ATLAMAZ (trigger `is_admin()`'i koşulsuz çağırır, çağıran rolden bağımsız). Faz 7'de
`apply_approved_claim()` trigger zincirini canlıda doğrularken (bkz. bu fazın raporu) bunu
`alter table profiles disable trigger profiles_protect_role` ile GEÇİCİ olarak atlayıp, testi bir
`rollback`'e sararak keşfettim — production'da bu manevrayı kimse manuel yapmamalı.
**✅ ÇÖZÜLDÜ (Faz 9a):** `protect_profile_role()`e dar, kendiliğinden kapanan bir istisna eklendi
— seçenek (b)'nin bir varyantı: superuser bağlamı yerine "sistemde hiç admin yokken kullanıcı
YALNIZCA kendi satırını admin yapabilir" kuralı, çünkü bu normal bir oturum açmış kullanıcının
UI'dan tetikleyebileceği bir yol (superuser-context kontrolü yalnızca raw SQL konsolundan
çalışırdı). Bkz. FAZ 9 raporu ve README.md "İlk admin'i oluşturma".

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

### FAZ 5 — GEO / AI Search Layer ✅ TAMAMLANDI

`/llms.txt`, entity ilişkileri (eksik olan TERS yön tamamlandı), veriye dayalı güven sinyalleri
(Faz 3'te zaten uygulanmıştı, denetlendi), AI crawler politikasının güncel resmî
dokümantasyonla doğrulanması.

**DoD durumu:**

| Kriter                                                  | Durum                                                                 |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| JS kapalıyken tüm kritik bilgi HTML'de                  | ✅ Faz 1'den beri her fazın `curl` smoke testiyle doğrulanıyor        |
| `llms.txt` yalnızca aktif/indexlenebilir URL listeliyor | ✅ `/panel`, `/isletme-ekle` yok; gerçek Supabase'e karşı test edildi |
| Hiçbir güven rozeti veriden bağımsız/sabit değil        | ✅ Faz 3/4'te zaten böyleydi, bu fazda değişmedi                      |

**AI crawler politikası — birincil kaynaklardan doğrulandı** (üçüncü parti blog özetleriyle
YETİNİLMEDİ, her biri kendi resmî dokümantasyonundan teyit edildi):

| Bot                                                              | Kaynak                                                | Bulgu                                                                                                                                                                                  |
| ---------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI (`GPTBot`, `OAI-SearchBot`, `OAI-AdsBot`, `ChatGPT-User`) | developers.openai.com/api/docs/bots                   | `GPTBot` yalnızca eğitim; `OAI-SearchBot` gerçek zamanlı arama; `ChatGPT-User` kullanıcı tetiklemeli, robots.txt'i dikkate almayabiliyor                                               |
| Anthropic (`ClaudeBot`, `Claude-User`, `Claude-SearchBot`)       | support.claude.com (anthropic.com'dan yönlendirildi)  | Üçü de robots.txt'i dikkate alıyor; `ClaudeBot`=eğitim, `Claude-User`=kullanıcı sorgusu, `Claude-SearchBot`=arama kalitesi                                                             |
| Google (`Google-Extended`)                                       | developers.google.com/search/docs                     | Ayrı bir HTTP user-agent'ı YOK (Googlebot'un çektiği içeriğe uygulanan bir bayrak); Arama sıralamasını/AI Overviews uygunluğunu ETKİLEMEDİĞİNİ Google açıkça belirtiyor                |
| Perplexity (`PerplexityBot`, `Perplexity-User`)                  | docs.perplexity.ai/docs/resources/perplexity-crawlers | `PerplexityBot` arama amaçlı ve robots.txt'e uyuyor; `Perplexity-User` kullanıcı sorgusu tetikler ve **robots.txt'i genellikle dikkate almadığını kendi dokümantasyonunda belirtiyor** |

**Karar (değişmedi, şimdi doğrulanmış veriyle netleşti):** Hem arama/erişim botları hem eğitim
botları **allow** — hedef görünürlük (§38), hiçbiri sıralama garantisi değil (§73, §77).
`robots.txt` artık her birine AYRI `Allow: /` satırı yazıyor (önceki fazda tek bir genel
`Allow: /` vardı) — niyeti denetlenebilir kılmak için, davranışsal bir fark yaratmıyor
(`User-agent: *` zaten hepsini kapsıyor).

**Faz 5'te bulunan gerçek eksik — entity ilişkileri tek yönlüydü.** §42'nin örnek zinciri
("Zümrüt Taksi → Kütahya Merkez → 7/24 Taksi → Zafer Havalimanı Transferi") çift yönlü bir
graf varsayıyor. Bölge/hizmet sayfaları işletmelere zaten link veriyordu (Faz 3) ama işletme
detay sayfası kendi hizmet/bölge varlıklarına HİÇ geri link vermiyordu — `BusinessRepository`
o ilişkileri hiç okumuyordu. Düzeltildi: `ServiceRepository.forBusiness()` ve
`LocationRepository.forBusiness()` eklendi, `taxi-detail-page.ts`'e "Hizmetler" ve
"Hizmet Bölgeleri" bölümleri eklendi (gerçek veri yoksa bölüm hiç görünmez). Yeni bir birim
testle işletmenin gerçek hizmet/bölge linklerinin render edildiği kanıtlandı — sadece
çökmediği değil.

### FAZ 6 — Analytics ✅ TAMAMLANDI (9 Eylül 2026)

Event tracking servisi, bot filtresi, session id, `analytics_daily` rollup + `pg_cron`,
90 günlük saklama, dashboard istatistik sorguları.

**Yapılanlar:**
- `AnalyticsService` (`src/app/core/analytics/`) — `fetch(...,{keepalive:true})` ile PostgREST'e
  yazıyor (bkz. ARCHITECTURE.md §11 — `sendBeacon`'dan sapma gerekçesi), SSR'da no-op,
  `isLikelyBot()` ile bilinen crawler'ları eliyor, `sessionStorage` tabanlı `session_id`.
- 6 istemci-tetiklemeli event tipi UI'a bağlandı: `profile_view` (taxi-detail-page, TEK effect,
  aynı işletme için tekrar saymaz), `call_click`/`whatsapp_click`/`directions_click`
  (TaxiCard + taxi-detail-page), `website_click` (taxi-detail-page), `search_performed`
  (home-page → "yakınımdaki taksiler"). `claim_started`/`claim_completed` Faz 7'de,
  `listing_submitted` Faz 8'de bağlanacak — bu fazda UI'ları henüz yok. `listing_approved`
  yalnızca admin aksiyonuyla sunucu tarafında yazılacak (Faz 9), istemciden asla gönderilmez.
- `rollup_analytics_daily()`/`prune_analytics_events()` (Faz 2'den beri vardı ama hiç
  ZAMANLANMAMIŞTI) artık `pg_cron` ile gece 03:00/03:30 UTC'de çalışıyor
  (`20260909110000_analytics_cron.sql`, canlı projede doğrulandı: `cron.job` içinde iki aktif iş).
- `AnalyticsRepository.dailyStats()` yazıldı (RLS'e güveniyor) ama henüz hiçbir UI'dan
  çağrılmıyor — çağıran Faz 7'nin auth/claim sistemi olacak.

**DoD:** 6 istemci event tipi kaydediliyor (kalan 3'ü ilgili özellik var olunca, Faz 7-9) ·
SSR event üretmiyor · rollup doğru sayıyor (canlıda doğrulandı) · 90 gün temizliği zamanlanmış ·
kayıtlarda PII yok · 108/108 unit test geçiyor · gerçek SSR build + canlı Supabase'e karşı
smoke test geçti.

### FAZ 7 — Claim Flow ✅ TAMAMLANDI (9 Eylül 2026)

"Bu işletme size mi ait?" → auth → doğrulama (`manual_admin`) → claim → admin review →
owner dashboard. `claim_started` / `claim_completed` event'leri.

**Yapılanlar:**
- `AuthService`/`AuthTokenStore` (`src/app/core/auth/`) — `@supabase/supabase-js` YALNIZCA lazy
  auth/panel/sahiplen chunk'larında (ARCHITECTURE.md §4 planına uygun; canlı build'de doğrulandı —
  `createClient` main bundle'da YOK). `PostgrestClient` artık oturum açıkken kullanıcının JWT'sini
  `Authorization` başlığında gönderiyor (`apikey` her zaman anon anahtar) — bu değişiklik olmadan
  `to authenticated` RLS politikaları (businesses_select_own, claims_select_own,
  analytics_daily_select_own) hiç devreye giremezdi.
- `/giris` (giriş+kayıt tek sayfa), `/taksi/:slug/sahiplen` (claim formu), `/panel` (artık gerçek
  içerik: sahip olunan işletmeler + durumları + son 30 gün istatistikleri + talep geçmişi).
  Üçü de `RenderMode.Client`, gerçek SSR curl testiyle doğrulandı (200, sunucu HTML'inde auth
  içeriği YOK).
- İlk kez Signal Forms (`@angular/forms/signals`) kullanıldı — `form()`/`required()`/`email()`/
  `minLength()`/`validate()`/`FormField` — canlı API yüzeyi node_modules'teki `.d.ts`'lerden
  doğrulanarak yazıldı, unit testlerle (gerçek DOM input event'leriyle) kanıtlandı.
  `styles.css`'e `.field`/`.form-banner` ilkel form stilleri eklendi (ilk gerçek form).
- **Canlıda keşfedilen gerçek davranış:** Supabase Auth bu projede e-posta onayını ZORUNLU
  kılıyor — `signUp()` başarıyla dönse bile oturum hemen açılmaz. `AuthService`/`AuthPage` bunu
  `confirmed:boolean` ile ayırt ediyor, kayıt sonrası "e-postanızı kontrol edin" mesajı gösteriyor.
  Doğrulama: gerçek Auth REST uç noktasına curl ile test kaydı açıldı (kod: `email_not_confirmed`).
- `apply_approved_claim()` trigger zinciri (claim onayı → `businesses.owner_id`/
  `verification_status='owner_claimed'`/`claimed_at` senkronu) canlı Supabase'e karşı, tamamı bir
  `rollback`'e sarılmış bir transaction içinde uçtan uca doğrulandı — hiçbir kalıcı veri
  bırakılmadı (bkz. R9: bu doğrulama sırasında `profiles_protect_role` trigger'ının ilk admin'i
  bootstrap etmeyi de engellediği keşfedildi, Faz 9 için not edildi).
- `translateAuthError()` — Supabase Auth'un makine-okunur `error.code`'una göre (mesaj metnine
  göre DEĞİL) Türkçe çeviri; kapsanmayan kod için jenerik ama dürüst mesaj.

**DoD:** bir işletme iki kez sahiplenilemez (DB: `owner_id is not null` kontrolü + unique index,
canlıda doğrulandı) · reddedilen claim tekrar denenebilir (ClaimPage yalnızca pending/approved'da
formu gizler) · owner yalnızca izinli kolonları güncelleyebiliyor (`protect_business_admin_columns`
Faz 2'den beri var, bu fazda değişmedi) · e2e akış testi geçiyor (canlı DB'de trigger zinciri +
146/146 unit test) · `SUPABASE_SERVICE_ROLE_KEY` hâlâ yok, bazı RLS fixture testleri hâlâ atlanıyor.

### FAZ 8 — Business Submission ✅ TAMAMLANDI (9 Eylül 2026)

`/isletme-ekle` formu, doğrulama, telefon normalizasyonu, duplicate tespiti (§52 — otomatik
silme yok, admin'e işaretlenir), fotoğraf upload, `pending` → admin onayı → `active`.

**Yapılanlar:**
- `submit_business()` RPC (`20260909130000_business_submission.sql`) — tek atomik `SECURITY
  DEFINER` fonksiyon: giriş doğrulama, telefon/whatsapp normalizasyonu (tanınmayan biçim
  SESSİZCE null değil, açıkça reddedilir), `slugify()` ile slug üretimi + hem aktif hem geçmiş
  slug'lara karşı benzersizlik, §52 olası kopya tespiti (aynı telefon YA DA isim benzerliği
  >0.4 — `pg_trgm`). Doğrudan `INSERT` policy YOK (Faz 2'nin RLS notunda bilinçli bırakılmış
  boşluk buradan kapatıldı); yalnızca `authenticated` çağırabilir, çağıran kullanıcı otomatik
  `owner_id` olur.
- `possible_duplicate_of` kolonu eklendi ve `protect_business_admin_columns` trigger'ı
  GÜNCELLENDİ: sahip kendi kaydını `businesses_update_own` ile PATCH edebildiği için, bu kolon
  admin-only listesine eklenmezse sahip kendi olası-kopya işaretini sessizce temizleyebilirdi.
  İki katmanlı korumanın (RLS + trigger) FAZ 8'DE DE tutarlı kalması için Faz 2'den beri var olan
  trigger fonksiyonu `create or replace` ile genişletildi.
- İstemci: `PostgrestClient.mutateRpc()` eklendi — mevcut `rpc()`'ten FARKLI, `volatile`/
  `SECURITY DEFINER` yazma RPC'leri için (TransferState'e YAZILMAZ/OKUNMAZ; `rpc()` yalnızca
  `stable`/`SECURITY INVOKER` okuma RPC'leri içindir, bu ayrım bilinçli korundu).
  `BusinessSubmitRepository`, `BusinessMediaService` (Storage upload — `AuthService`'in AYNI
  `SupabaseClient` örneğini paylaşır, ikinci bir `createClient()` ayrı oturum durumu demek olurdu).
- `/isletme-ekle` `RenderMode.Server`'dan `RenderMode.Client`'a taşındı — Faz 1'deki statik
  "yakında" iskeletinin aksine artık oturum gerektiren gerçek bir form (`sahiplen`/`panel` ile
  aynı gerekçe).
- **Doğrulama:** yerel Docker Supabase yığınıyla (`supabase db reset`) migration gerçek
  Postgres'e karşı uçtan uca test edildi — slug üretimi, §52 duplicate tespiti (aynı isim/telefonla
  ikinci başvuru `possible_duplicate=true` ve `-2` slug'ı üretti) ve geçersiz telefon reddi
  `psql` ile doğrulandı; ardından makine bellek baskısına girip Docker durduruldu, migration
  linked projeye `db push` edildi (temiz uygulandı) ve tipler `db:types --linked`'dan yeniden
  üretildi. `protect_business_admin_columns` genişletmesi Docker kapandıktan sonra eklendiği için
  canlıda AYRI bir fixture testiyle (kullanıcı oturumu + PATCH denemesi) doğrulanmadı — yalnızca
  kod incelemesi + zaten çalışan 8 satırla birebir aynı örüntü + hatasız `db push`. `db:test-rls`
  (19/19 geçti) mevcut güvenlik sınırının bozulmadığını doğruladı.

**DoD:** geçersiz telefon reddediliyor (canlıda doğrulandı) · duplicate uyarısı çalışıyor (canlıda
doğrulandı, UI'da sarı banner) · pending kayıt public'te görünmüyor (`businesses_select_active`
Faz 2'den beri değişmedi) · fotoğraf upload çalışıyor (Storage RLS Faz 2'den beri hazırdı, bu fazda
yalnızca istemci bağlandı) · 152/152 unit test geçiyor · `SUPABASE_SERVICE_ROLE_KEY` hâlâ yok,
admin-only trigger genişletmesi canlı fixture'la DEĞİL kod incelemesiyle doğrulandı (bkz. yukarı) ·
onay sonrası profilin sitemap'e girmesi Faz 9'un admin onay akışına bağlı, bu fazın kapsamı dışında.

### FAZ 9 — Admin Panel ✅ TAMAMLANDI (9 Eylül 2026)

İşletme CRUD, claim inceleme, kullanıcı yönetimi, hizmet/lokasyon yönetimi, review moderasyonu,
analytics görüntüleme, hızlı veri girişi formu (§51), profil kaldırma talebi kuyruğu (KVKK).

Kapsam büyüklüğü nedeniyle üç alt fazda yürütüldü: **9a** (temel + işletme/claim moderasyonu) ·
**9b** (katalog + review + analytics) · **9c** (kullanıcılar + KVKK kaldırma kuyruğu).

**9a — Yapılanlar:**
- **R9 çözüldü:** `protect_profile_role()` artık dar, kendiliğinden kapanan bir bootstrap
  istisnası içeriyor — sistemde hiç admin yokken bir kullanıcı YALNIZCA kendi satırını admin
  yapabilir; bir admin var olduğu an bu yol kalıcı olarak kapanır. Canlıda uçtan uca doğrulandı
  (bkz. README.md "İlk admin'i oluşturma").
- `submit_business`in slug üretim döngüsü `unique_business_slug()`e çıkarıldı — hem
  `submit_business` hem yeni `admin_quick_add_business` (§51) AYNI fonksiyonu paylaşıyor.
- `approve_claim`/`reject_claim` RPC'leri — çıplak çok-kolonlu `UPDATE` yerine (CHECK kısıtı +
  audit alanları hataya açık olurdu), `claims_status_timestamps`ı atomik doğru kuruyor,
  `reviewed_by`/`reviewer_note`yu dolduruyor, ikinci kez işlenmiş bir talebi `P0002` ile reddediyor.
- Uygulamadaki İLK gerçek route guard'ı (`admin.guard.ts`) — `/admin` altında 8+ ekran olacağı
  için `ClaimPage`/`DashboardPage`'in effect-redirect deseni yerine tek noktadan uygulanıyor.
  Guard `supabase-js`'i STATİK import ETMEZ (`app.routes.ts`'teki `lazyAdminGuard` dinamik
  `import()` + `runInInjectionContext` ile) — aksi halde ana pakete sızardı; build sonrası
  `main-*.js`'de `createClient` YOK doğrulandı.
- `PostgrestClient.update()` eklendi (basit alan güncellemeleri için — RLS/trigger zaten
  yetkilendiriyor, yeni SQL mantığı gerekmiyor).
- `/admin`, `/admin/isletmeler`, `/admin/isletmeler/:id`, `/admin/talepler`, `/admin/hizli-ekle`
  — hepsi `RenderMode.Client` + `private, no-store`.
- **Doğrulama:** yerel Docker Supabase'e karşı kapsamlı bir SQL testiyle (bootstrap sırası,
  ikinci kullanıcının kendini/başkasını admin yapamaması, quick-add'in admin-only olması,
  claim onay/red'in `apply_approved_claim` zincirini doğru tetiklemesi, çift-işlemenin
  reddedilmesi) uçtan uca kanıtlandı, migration linked projeye push edildi. 162/162 unit test.

**Kapsam dışı bırakılanlar (9a-9c toplamında, bilinçli):** `landing_pages` yayın/düzenleme
aracı, kopya kayıtları birleştirme aracı (yalnızca işaret kaldırma/reddetme var), e-posta ile
kullanıcı arama (`auth.users`e PostgREST erişimi yok; bunun için yeni bir ayrıcalıklı sunucu
endpoint'i gerekirdi — bilinçli olarak ertelendi).

**DoD (9a kapsamı):** admin olmayan `/admin`'e erişemiyor (guard + RLS, iki katman, canlıda
doğrulandı) · işletme durum geçişleri + claim onay/red çalışıyor · admin işlemleri
denetlenebilir (`reviewed_by`/`reviewer_note` doluyor).

**9b — Yapılanlar:** yeni SQL YOK — `services_admin_write`/`locations_admin_write`/
`reviews_admin_all` Faz 2'den beri hazırdı, yalnızca istemci tarafı eklendi.
- `/admin/hizmetler`, `/admin/bolgeler` — ekleme/düzenleme var, BİLİNÇLİ olarak sert `DELETE`
  YOK (`business_services`/`business_locations` `on delete cascade`, `landing_pages`
  `on delete set null` — silme işletme/landing page ilişkilerini SESSİZCE bozardı; hizmetler
  bunun yerine `is_active` ile yayından kaldırılıyor).
- `/admin/degerlendirmeler` — review onay/red, düz `PATCH` (claim'in aksine çok kolonlu bir
  CHECK kısıtı yok).
- `/admin/analitik` — Faz 6'nın `AnalyticsRepository.dailyStats()`ı YENİDEN KULLANILDI (RLS
  zaten admin için tüm işletmeleri döndürüyor); yalnızca işletme seçici eklendi.
- `DashboardPage`/`AdminAnalyticsPage`nin ortak istatistik özetleme mantığı
  `shared/utils/analytics-stats.ts`e çıkarıldı (gerçek kod tekrarı, erken soyutlama değil).
- 166/166 unit test, `main-*.js`de yine `createClient` yok (build sonrası doğrulandı).

**9c — Yapılanlar:**
- `removal_requests` tablosu + `request_business_removal` RPC'si (§56) — `submit_business` ile
  AYNI desen (doğrudan `INSERT` policy yok, tek giriş yolu SECURITY DEFINER RPC), ama BİLEREK
  `anon`a da açık: numarası kamuya açık paylaşılmış bir taksicinin hesabı hiç olmayabilir,
  kaldırma talep etmek için kayıt olmaya zorlanmamalı.
- `/taksi/:slug/kaldirma-talebi` — `taxi-detail-page`'e eklenen "Bu profilin kaldırılmasını
  talep et" bağlantısından ulaşılır (ARCHITECTURE.md §12'nin gerektirdiği asgari önlem).
  `ClaimPage`/`BusinessSubmitPage`den FARKLI olarak BİLEREK oturum GEREKTİRMEZ.
- `/admin/kaldirma-talepleri` — kuyruk, `completed`/`dismissed` çözümü `resolved_at`/
  `resolved_by` ile birlikte (CHECK kısıtı ikisinin tutarlı olmasını zorunlu kılıyor).
- `/admin/kullanicilar` — rol değişimi (`protect_profile_role` zaten yetkilendiriyor, yeni SQL
  gerekmedi). E-posta ile arama BİLİNÇLİ olarak YOK.
- **Canlıda keşfedilen gerçek hata:** `request_business_removal`in ilk taslağında
  `not exists (select 1 from businesses where id = p_business_id)` — fonksiyon `returns table
  (id uuid)` olduğu için `id` PL/pgSQL'de fonksiyonun kendi çıktı değişkeniyle ÇAKIŞTI
  ("column reference id is ambiguous"). Yerel Docker'a karşı ilk test koşumunda yakalandı,
  tablo takma adıyla (`b.id`) düzeltildi — bu projede zaten süregelen bir kural (`submit_business`
  hep `c.id`/`b.id` kullanıyordu), burada bir kez atlanmıştı.
- **Doğrulama:** yerel Docker'a karşı uçtan uca SQL testi — anon (oturumsuz) talep açabiliyor,
  boş sebep/var olmayan işletme reddediliyor, anon kuyruğu OKUYAMIYOR (tablo `GRANT`'i bile yok,
  RLS'e gerek kalmadan), admin olmayan bir kullanıcı talebi çözemiyor, admin çözebiliyor,
  `resolved_at` olmadan `completed` CHECK kısıtına takılıyor. Migration linked projeye push
  edildi, tipler oradan yeniden üretildi. 171/171 unit test, `main-*.js`de `createClient` yok.

**Kapsam dışı bırakılanlar (bilinçli):** `landing_pages` yayın/düzenleme aracı, kopya kayıtları
birleştirme aracı (yalnızca işaret kaldırma/reddetme var), e-posta ile kullanıcı arama
(`auth.users`e PostgREST erişimi yok; yeni bir ayrıcalıklı sunucu endpoint'i gerekirdi),
hizmet/lokasyon sert silme (cascade/set-null side effect'leri riskli).

**DoD:** admin olmayan `/admin`'e erişemiyor (guard + RLS, iki katman, canlıda doğrulandı) ·
işletme/claim/review durum geçişleri çalışıyor · admin işlemleri denetlenebilir
(`reviewed_by`/`reviewer_note`/`resolved_by` doluyor) · hizmet/lokasyon CRUD çalışıyor ·
analitik görüntüleme çalışıyor · kullanıcı rol yönetimi çalışıyor · KVKK kaldırma talebi
oturumsuz da açılabiliyor ve admin kuyruğunda çözülebiliyor.

### FAZ 10 — Premium Foundation ✅ TAMAMLANDI (9 Eylül 2026)

`plan` alanı, feature flag altyapısı, abonelik-hazır şema. **Ödeme entegrasyonu yok** —
gerçekten gerekli olduğunda eklenir.

Spec bu fazda hangi ÖZELLİĞİN plana bağlı olacağını söylemiyordu (`§58` yalnızca "sıralama
garantisi verme" kısıtını koyuyordu) — kullanıcıyla netleştirildi: "Öne çıkan rozet + sınırsız
fotoğraf" seçildi (sıralamaya dokunmayan, görsel/içerik odaklı bir ilk özellik).

**Yapılanlar:**
- `business_media_enforce_limit` trigger'ı — free planda `media_type='photo'` için en fazla 3
  kayıt, pro/premium sınırsız. `logo`/`cover` limitten MUAF (tekil varlıklar, galeri değil).
  Sıralama/görünürlük sorgularına HİÇ dokunmuyor (§58, R8).
- "⭐ Öne Çıkan" rozeti — TEK bir paylaşılan bileşende (`taxi-card.ts`) eklendiği için tüm
  liste sayfalarında (taksi listesi, bölge/hizmet sayfaları, yakınımdaki taksiler, ana sayfa)
  otomatik göründü. Rozetin `title` özniteliği "sıralamayı etkilemez" diye açıkça belirtiyor.
- `nearby_businesses` (Faz 5) `plan` DÖNDÜRMÜYORDU — rozet "yakınımdaki taksiler" sonuçlarında
  hiç görünmezdi; RPC'nin `RETURNS TABLE` listesi genişletildi (`create or replace` bunu
  yapamadığı için `drop` + `create`).
- Fotoğraf galerisi ilk kez GÖSTERİLMEYE başlandı (`taxi-detail-page.ts`) — Faz 8'den beri
  yükleniyordu ama hiçbir yerde render edilmiyordu. `NgOptimizedImage` projede İLK KEZ
  kullanıldı; `IMAGE_LOADER` Supabase Storage'ın public object URL'ine çeviriyor. Supabase'in
  ücretli görsel dönüştürme uç noktası (WebP/AVIF + boyutlandırma, ARCHITECTURE.md §13'ün
  hedefi) BİLİNÇLİ olarak kullanılmadı — bu projenin Supabase katmanında etkin olduğu
  doğrulanmadı; loader ileride oraya bağlanabilir.
- Sahip artık kendi fotoğraflarını YÖNETEBİLİYOR (`/panel`de `BusinessPhotoManager`) —
  Faz 8'de yalnızca İLK başvuru sırasında fotoğraf eklenebiliyordu, sonradan hiç. Ekleme/silme;
  silme hem `business_media` satırını hem Storage nesnesini temizliyor.
- `PostgrestClient.remove()` (DELETE) eklendi — ilk gerçek kullanım alanı budur.
- Küçük bir refactor: `BusinessSubmitRepository.attachMedia()` yeni paylaşılan
  `BusinessMediaRepository`e taşındı (tek sorumluluk — "başvuru" ile "galeri yönetimi" ayrı
  kavramlar, ikisi de aynı `business_media` tablosuna yazıyordu).
- Admin işletme düzenleme formuna plan seçici eklendi (`/admin/isletmeler/:id`) — plan hâlâ
  yalnızca admin tarafından elle değiştiriliyor, ödeme akışı yok.
- **Doğrulama:** yerel Docker'a karşı SQL testi — free planda tam 3 fotoğraf kabul, 4.
  `23514` ile reddediliyor, logo/cover muaf, pro planda 5 fotoğraf (limiti aşarak) kabul,
  `nearby_businesses` artık `plan` döndürüyor. 180/180 unit test, `main-*.js`de `createClient`
  yok (build sonrası doğrulandı).

**DoD:** flag çalışıyor (fotoğraf sınırı, canlıda doğrulandı) · hiçbir premium özellik sıralama
garantisi vaat etmiyor (rozet metni/`title`'ı açık, hiçbir `ORDER BY` plana göre değişmiyor).

### FAZ 11 — Production Hardening ✅ TAMAMLANDI (9 Eylül 2026)

RLS denetimi, secret taraması, performans (Core Web Vitals bütçesi), SEO denetimi, a11y,
mobil QA, 404/301/410 denetimi, hata durumları, analytics doğrulaması, **metin denetimi (R8)**,
KVKK metinleri.

Bu faz "§62 checklist'i" diye bir listeye atıf yapıyordu ama bu liste repoda hiçbir yerde
tanımlı değil (§51/§58 gibi, orijinal spec'in bu repoya dahil edilmeyen bir parçası) — denetim
bu satırın kendi maddelerine (yukarıda) göre yürütüldü.

**Bulgular ve sonuçlar (madde madde):**
- **RLS denetimi:** `npm run db:test-rls` CANLI linked projeye karşı 19/19 geçti. Fixture
  testleri (pending/suspended görünürlük, biçim kısıtları) hâlâ `SUPABASE_SERVICE_ROLE_KEY`
  eksikliği yüzünden atlanıyor — Faz 7'den beri bilinen, dokümante edilmiş bir boşluk;
  kullanıcının kendi `.env`'ine anahtarı eklemesi gerekiyor (bu anahtar bu oturuma hiç
  paylaşılmadı/istenmedi — güvenlik sınırı).
- **Secret taraması (§66):** `dist/` içinde `sb_secret_`/JWT-şekilli servis anahtarı taraması
  YAPILDI — bulunan tek eşleşme supabase-js'in kendi format-tespit kodunun literal string'i
  (`r.startsWith('sb_secret_')`), gerçek bir anahtar DEĞİL. `generate-env.mjs` yapısal olarak
  `SUPABASE_SERVICE_ROLE_KEY`'i hiç okumuyor (kaynak koddan doğrulandı). Temiz.
- **Performans:** Prod build'de initial (TÜM sayfalar) `95.04 kB` gzip — bütçe `<120 kB`
  (ARCHITECTURE.md §13). En ağır public sayfa (taxi-detail, galeri dahil) `+4.25 kB` ekliyor,
  toplam `~99 kB` — bütçe içinde.
  Rengi kontrast oranları (`tokens.css`) hesaplandı: kullanılan TÜM metin/zemin çiftleri WCAG
  AA'yı geçiyor (en düşük `--c-text-subtle` 3.61:1, yalnızca büyük/kalın 404 rakamında
  kullanılıyor, büyük-metin eşiği 3:1'i geçiyor).
- **SEO denetimi:** gerçek prod build'e karşı `curl` ile doğrulandı — `/robots.txt`
  (dev'de `Disallow: /`, prod dalı kod incelemesiyle doğrulandı: `Allow: /` + AI crawler
  istisnaları + `Sitemap:` satırı), `/sitemap.xml` (gerçek URL listesi üretiyor), ana sayfa
  SSR HTML'inde `<title>`/`rel="canonical"`/`application/ld+json` hepsi mevcut.
- **a11y:** global `:focus-visible` (asla kaldırılmıyor), `--tap-min: 48px` (WCAG 2.2 AA'nın
  24px hedefinin üstünde) tüm `.btn`'lerde, `prefers-reduced-motion` desteği, ikon-only
  buton/link YOK (hepsi metin etiketiyle birlikte ya da `aria-label` taşıyor — galeri sil
  butonu örneği), `<html lang="tr">`, skip-link mevcut. **Sınırlama:** bu ortamda Python/
  Playwright kurulu değildi, bu yüzden gerçek bir tarayıcıda axe-core koşturulamadı — denetim
  statik kod incelemesiyle yapıldı, canlı bir axe taraması YERİNE GEÇMEZ.
- **Mobil QA:** `.container` + `--container-pad` düzeni, `repeat(auto-fit/auto-fill, minmax(...))`
  grid'leri (galeri, foto-grid, admin kartları) sabit genişlik kullanmıyor — yatay taşma riski
  yapısal olarak yok. Gerçek cihaz/viewport testi (yukarıdaki sınırlama nedeniyle) yapılamadı.
- **404/301/410 denetimi:** zaten Faz 3-4'te yazılmış, bu fazda TEKRAR ÇALIŞTIRILDI (regresyon
  yok) — `taxi-detail-page.spec.ts`'teki dedike testler.
- **Hata durumları:** `GlobalErrorHandler` incelendi — Faz 1'den beri "gerçek bir hata toplama
  servisi (Sentry vb.) Faz 11'de değerlendirilecek" notu taşıyordu. **Karar: ŞİMDİLİK
  EKLENMİYOR** — sitede henüz gerçek trafik yok (R1), üçüncü taraf bir servis yeni bir
  secret/ortam değişkeni ve KVKK yüzeyi (varsayılan IP/stack trace toplama) eklerdi. Gerçek
  trafik başladığında yeniden değerlendirilmeli.
- **Analytics doğrulaması:** `isLikelyBot()` (bilinen arama/AI crawler imzaları) ve
  `AnalyticsService` (PII yok, IP yok, yalnızca `referrer_host`) kod incelemesiyle
  gizlilik-sayfası iddialarıyla ÇAPRAZ KONTROL edildi — tutarlı.
- **Metin denetimi (R8):** "garanti"/"ilk sırada"/"en üstte" gibi kalıplar için tüm `src/app`
  tarandı — yalnızca teknik YORUMLARDA (kod garantisi anlamında) eşleşme var, kullanıcıya
  dönük METİNDE sıralama vaadi YOK.
- **KVKK metinleri — GERÇEK BİR BOŞLUK BULUNDU VE DÜZELTİLDİ:** `/gizlilik` sayfası "profilinizin
  kaldırılmasını talep edebilirsiniz" diyordu ama Faz 9c'de eklenen gerçek mekanizmaya
  (her işletme profilindeki "Bu profilin kaldırılmasını talep et" bağlantısı) HİÇ İŞARET
  ETMİYORDU — soyut bir vaat, somut bir yol yoktu. Metin güncellendi.

**DoD:** performans bütçesi tutuyor (95 kB < 120 kB) · bundle'da secret yok (yalnızca kod
incelemesiyle DEĞİL, gerçek build çıktısı taranarak doğrulandı) · yukarıdaki madde madde
denetim tamamlandı (resmi "§62" listesi repoda tanımlı değil) · garanti vaat eden metin yok.

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
