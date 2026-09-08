# PROJECT_PLAN.md — Kütahya Taksi Ağı

> Durum: **FAZ 0 tamamlandı.** Sıradaki: FAZ 1 — Project Foundation.
> Son güncelleme: 8 Eylül 2026

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

| | Sayı |
|---|---|
| Kütahya ilinde kayıtlı taksi durağı | **8** |
| Bunlardan isimli olan | 6 |
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

### FAZ 1 — Project Foundation

Angular 22 workspace (SSR açık), feature klasör iskeleti, routing, environment, design token'lar,
global error handler, loading/skeleton, 404 sayfası, lint + prettier, ilk Vercel deploy.

**DoD:** `npm run build` temiz · lint temiz · Vercel'de canlı URL · **`curl` ile ham HTML'de
sunucuda render edilmiş içerik görünüyor (R3 kanıtı)** · 404 doğru status kodu dönüyor.

### FAZ 2 — Supabase Foundation

Supabase projesi, migration'lar (tüm tablolar/enum/index/FK), RLS policy'leri, `is_admin()`,
Storage bucket'ları, Auth ayarları, seed script iskeleti, `landing_pages` view'ı.

**DoD:** migration'lar sıfırdan temiz uygulanıyor · **RLS testleri geçiyor** (anon pending
işletme göremez; owner başkasının kaydını yazamaz; owner `status` değiştiremez; anon
`analytics_events` okuyamaz) · Storage policy testleri geçiyor.

### FAZ 3 — Public Website

Ana sayfa, `/taksi` listesi, `/taksi/:slug` detay, `/bolge/:slug`, `/hizmet/:slug`,
taksi kartı (Ara / WhatsApp / Yol Tarifi), mobile-first responsive, boş-durum ekranları.

**DoD:** tüm sayfalar SSR'da veriyle geliyor · telefon `tel:` çalışıyor · WhatsApp **yalnızca
`whatsapp_e164` doluysa** görünüyor · a11y denetimi geçiyor · gerçek mobil cihazda test edildi.

### FAZ 4 — SEO Engine

`SeoService`, JSON-LD üreticileri, breadcrumb, dinamik `sitemap.xml`, ortam-duyarlı
`robots.txt`, canonical politikası (`/taksi` vs `/kutahya-taksi` kararının kesinleştirilmesi),
`business_slug_history` → 301, arşiv → 410, internal linking.

**DoD:** §62 checklist'i her sayfa tipi için geçiyor · JSON-LD validator temiz ·
schema ↔ HTML tutarlılık testi geçiyor · sitemap yalnızca indexable URL içeriyor ·
preview ortamı `Disallow: /` veriyor.

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

**DoD:** domain canlı ve HTTPS · sitemap Search Console'a gönderildi · production smoke test
geçti · gerçek bir telefon tıklaması analytics'te görünüyor.

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
