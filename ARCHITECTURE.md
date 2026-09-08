# ARCHITECTURE.md — Kütahya Taksi Ağı

> Durum: **FAZ 0 — DISCOVERY tamamlandı.** Bu belge mimari kararları ve gerekçelerini içerir.
> Son güncelleme: 8 Eylül 2026

---

## 1. Mevcut Durum (Discovery Bulguları)

`C:\dev\taxi43` **tamamen boştu**. Kod, `package.json`, git geçmişi, Angular workspace, Supabase yapılandırması yok.
Bu bir **greenfield** projedir; migrate edilecek eski kod yoktur.

### Doğrulanan toolchain

| Bileşen                 | Sürüm            | Not                                        |
| ----------------------- | ---------------- | ------------------------------------------ |
| Node.js                 | 24.18.0          | Angular 22 için yeterli                    |
| npm                     | 11.17.0          |                                            |
| Angular CLI (global)    | 22.0.6           | `@angular/core` latest: **22.1.5**         |
| `@angular/ssr`          | 22.1.7           |                                            |
| `@supabase/supabase-js` | 2.116.0          |                                            |
| git                     | 2.55.0           | repo bu fazda `main` olarak init edildi    |
| Supabase CLI            | **kurulu değil** | Faz 2 öncesi gerekli (`npm i -D supabase`) |
| Vercel CLI              | **kurulu değil** | Faz 12 öncesi gerekli                      |

**Karar:** Angular **22.1.x** kullanılacak. Prompt "Angular 20+" diyor; 22 mevcut stable ve `outputMode` /
route bazlı `RenderMode` API'sinin olgunlaştığı sürüm.

### Mevcut olmayan her şey

Route yok, component yok, styling yok, backend yok, Supabase projesi yok, deployment yok, domain yok.

---

## 2. Sistem Mimarisi (üst seviye)

```
              Google / ChatGPT / Gemini / Perplexity / direkt trafik
                                  |
                                  v
                  +-------------------------------+
                  |   Vercel Edge (CDN + cache)   |
                  +-------------------------------+
                    |                          |
        statik asset|                          | dinamik istek
                    v                          v
           dist/browser (immutable)   Node Serverless Function
                                        (Angular SSR handler)
                                               |
                                               | PostgREST (anon key)
                                               v
                                  +---------------------------+
                                  |    Supabase (PostgreSQL)  |
                                  |  RLS + Auth + Storage     |
                                  +---------------------------+
                                               ^
                                               | tarayıcı (auth'lu)
                                  dashboard / admin / claim akışı
```

**Tek yazılabilir arka uç Supabase'tir.** Ayrı bir Node API katmanı **yoktur** — bu kasıtlı bir
sadelik kararıdır (§82 overengineering yasağı). İş mantığı iki yerde yaşar: PostgreSQL
(constraint, trigger, RLS, RPC) ve Angular. Bu ikisinin arasında üçüncü bir katman MVP'de yok.

---

## 3. KRİTİK KARAR — Rendering Stratejisi

Bu, geri dönüşü en pahalı karardır. Açıkça belirtiyorum.

### Seçilen: `outputMode: "server"` + route bazlı `RenderMode`

Angular 22, her route için ayrı render modu tanımlamayı destekler:

```ts
// app.routes.server.ts
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server }, // ana sayfa
  { path: 'taksi', renderMode: RenderMode.Server }, // liste
  { path: 'taksi/:slug', renderMode: RenderMode.Server }, // detay
  { path: 'bolge/:slug', renderMode: RenderMode.Server },
  { path: 'hakkinda', renderMode: RenderMode.Prerender }, // statik içerik
  { path: 'gizlilik', renderMode: RenderMode.Prerender },
  { path: 'panel/**', renderMode: RenderMode.Client }, // dashboard
  { path: 'admin/**', renderMode: RenderMode.Client }, // admin
  { path: '**', renderMode: RenderMode.Server },
];
```

### Neden tam prerender (`outputMode: "static"`) değil?

Prerender cazip görünüyor (sıfır sunucu, mükemmel LCP) ama **içerik veritabanından geliyor ve
admin onayıyla değişiyor**. Tam static'te:

- admin bir işletmeyi onayladığında sayfa yayına girmez, **yeniden deploy gerekir**;
- taksici panelden telefonunu güncellediğinde site eski numarayı gösterir — bu ürünün **temel
  vaadini** (doğru, güncel bilgi — §41) doğrudan ihlal eder;
- her onay için CI tetiklemek bir directory ürününde sürdürülemez ops yüküdür.

### Neden tam SSR de değil (hibrit)?

Panel ve admin SEO'ya konu değil; onları sunucuda render etmek boşuna sunucu maliyeti ve
gereksiz karmaşıklık. `RenderMode.Client` ile lazy chunk olarak kalırlar.

### Tazelik + hız: CDN cache

Public SSR sayfaları Vercel'de edge cache'lenecek:

```
Cache-Control: public, s-maxage=300, stale-while-revalidate=86400
```

Böylece crawler ve kullanıcı çoğunlukla edge'den ~statik hızda cevap alır; içerik değiştiğinde
en geç 5 dakikada tazelenir. İşletme güncellendiğinde ilgili path'ler için cache invalidation
Faz 11'de değerlendirilecek (MVP'de `s-maxage` yeterli).

### Vercel + Angular SSR — bilinen sürtünme (RİSK)

Araştırma sonucu: **Vercel'in Angular SSR için zero-config desteği yok.** Vercel `index.html`
görüp static servis edebiliyor ve `server.mjs` hiç çağrılmıyor ("SSR açık ama SSR çalışmıyor"
tuzağı). Çözüm iyi bilinen iki dosyalık bir adapter:

```
api/index.mjs   -> dist/<app>/server/server.mjs içindeki reqHandler'ı export eder
vercel.json     -> dinamik trafiği /api'ye rewrite eder, dist/<app>/browser'ı static verir
```

Bu düşük riskli ama **sıfır risk değil**; Faz 1'in sonunda "merhaba dünya" seviyesinde
Vercel'e deploy edip SSR'ın gerçekten çalıştığını **kanıtlamadan** Faz 3'e geçilmeyecek.
(Kanıt yöntemi: `curl` ile ham HTML'de dinamik içeriğin görünmesi.)

**Faz 1 sonucu:** adapter yazıldı, SSR lokal olarak kanıtlandı (rastgele slug istek
anında render ediliyor). Vercel üzerindeki doğrulama domain/hesap bağlandığında
yapılacak.

### İkinci tuzak: `allowedHosts` (Faz 1'de yaşandı)

Angular SSR, SSRF'e karşı istek hostname'ini doğrular ve tanınmayan host için
**tüm sayfalarda 400** döner — hata mesajı nedeni açıklamaz. Varsayılan liste boştur,
yani hiçbir ayar yapılmazsa `localhost` bile reddedilir.

`src/server.ts` host listesini `NG_ALLOWED_HOSTS` ile birlikte Vercel'in otomatik
sağladığı `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` / `VERCEL_BRANCH_URL`
değişkenlerinden toplar; böylece preview deployment'ları ek ayar istemez. **Özel
domain bağlandığında `NG_ALLOWED_HOSTS` mutlaka tanımlanmalıdır** — Faz 12 kontrol
listesinde.

Kaynaklar: [Angular SSR guide](https://angular.dev/guide/ssr) ·
[Essential Angular SSR Config To Deploy On Vercel](https://dev.to/this-is-angular/essential-angular-ssr-config-to-deploy-on-vercel-2lka) ·
[angular-ssr-vercel örneği](https://github.com/duxor/angular-ssr-vercel)

---

## 4. KRİTİK KARAR — Veri Erişim Katmanı

### Public okuma yolları `supabase-js` KULLANMAYACAK

Bunun yerine Supabase'in PostgREST endpoint'i Angular `HttpClient` ile çağrılacak:

```
GET {SUPABASE_URL}/rest/v1/businesses?select=...&status=eq.active&slug=eq.zumrut-taksi
Headers: apikey: <anon>, Authorization: Bearer <anon>
```

**Üç somut kazanç:**

1. **TransferState bedava gelir.** `provideClientHydration(withHttpTransferCacheOptions(...))`
   yalnızca `HttpClient` trafiğini yakalar. `supabase-js` kendi `fetch`'ini kullandığı için
   transfer cache'e **girmez** — yani sunucuda çekilen veri hydration'da ikinci kez çekilir.
   Bu, SEO-first bir sitede kabul edilemez bir veri/INP israfıdır.
2. **Bundle boyutu.** `supabase-js` (gotrue + realtime + storage + postgrest) public kritik
   yola girmez. Ana sayfa ve detay sayfası LCP'si için doğrudan kazanç (§44).
3. **Cache kontrolü.** HttpClient interceptor ile public sorgulara tek noktadan cache header /
   retry / hata yönetimi uygulanabilir.

### `supabase-js` nerede kullanılacak?

Yalnızca **lazy-loaded** `auth`, `dashboard`, `admin`, `claim` feature'larında — Auth (session
yönetimi, token refresh), Storage (fotoğraf upload) ve yazma işlemleri için. Public kullanıcı
bu chunk'ı hiç indirmez.

### Katman şekli

```
core/data/
  public-api.client.ts     # PostgREST + HttpClient, SSR-safe, TransferState'li
  business.repository.ts   # sorgu kurucular, tipli dönüşler
  location.repository.ts
  service.repository.ts
core/supabase/
  supabase.client.ts       # supabase-js, SADECE lazy feature'larda inject edilir
```

---

## 5. Angular Uygulama Mimarisi

```
src/
  app/
    core/
      analytics/      # event tracking, bot filtreleme, session id
      config/         # runtime config, feature flags
      data/           # PostgREST repository katmanı (public okuma)
      supabase/       # supabase-js (auth/storage/yazma) — lazy
      seo/            # title/meta/canonical/OG servisi
      schema/         # JSON-LD üreticileri
      guards/         # authGuard, adminGuard, ownerGuard
      interceptors/   # http error, cache
      errors/         # global error handler
    shared/
      ui/             # button, card, badge, skeleton, empty-state
      components/     # taxi-card, call-button, whatsapp-button, directions-button
      models/         # tipler (DB tiplerinden türetilmiş)
      pipes/          # phoneDisplay, trDate
      utils/          # slugify, phone normalize
    features/
      home/  taxis/  taxi-detail/  taxi-claim/  business-submit/
      dashboard/  auth/  locations/  services/  guides/  admin/  legal/
    app.routes.ts
    app.routes.server.ts
    app.config.ts
    app.config.server.ts
  styles/
    tokens.css        # design tokens (renk, spacing, tipografi, radius)
    reset.css
    global.css
```

**Kurallar:**

- Yalnızca standalone component. NgModule yok. `standalone: true` **yazılmaz** (v20+ varsayılan).
- `changeDetection: OnPush` **açıkça yazılmaz** — Angular 22'de varsayılan zaten OnPush.
- Uygulama **zoneless** çalışır (`zone.js` bağımlılığı yok). State için Signals;
  global store kütüphanesi **yok** (§82).
- Her feature lazy loaded (`loadComponent` / `loadChildren`).
- `core/` yalnızca root'ta sağlanır; `shared/` state tutmaz.
- TypeScript `strict: true`, `strictTemplates: true`, `noUncheckedIndexedAccess: true`,
  `exactOptionalPropertyTypes: true`.
- Yol takma adları: `@core/*`, `@shared/*`, `@features/*`, `@env`.
- Formlar: Angular 22'de **Signal Forms** (`@angular/forms/signals`) stabil ve
  önerilen yol. Prompt §5 "Reactive Forms" diyor; ikisi de reaktif ve tip güvenli,
  Signal Forms bu sürümde daha iyi eşleşiyor. Karar Faz 7/8'de form yazılırken
  kesinleşecek — o zamana kadar ikisi de açık.

---

## 6. Veritabanı Şeması

PostgreSQL 15+ (Supabase). Uzantılar: `pgcrypto`, `postgis`, `pg_trgm`, `unaccent`.

### Enum'lar

```sql
create type business_status       as enum ('pending','active','suspended','rejected','archived');
create type verification_status   as enum ('unverified','pending','verified','owner_claimed');
create type source_type           as enum ('manual','public_business_listing','owner_submitted','owner_verified','osm');
create type location_type         as enum ('city','district','neighborhood','landmark','airport','hospital','university','bus_station');
create type claim_status          as enum ('pending','approved','rejected','cancelled');
create type verification_method   as enum ('phone_otp','callback','document','manual_admin');
create type user_role             as enum ('customer','business_owner','admin');
create type review_status         as enum ('pending','approved','rejected');
create type media_type            as enum ('logo','photo','cover');
create type business_plan         as enum ('free','pro','premium');
create type analytics_event_type  as enum ('profile_view','call_click','whatsapp_click','directions_click',
                                           'website_click','claim_started','claim_completed',
                                           'listing_submitted','listing_approved','search_performed');
```

### `businesses` (çekirdek tablo)

Prompt §7'deki alanlara ek olarak **veri dürüstlüğü** ve **gelecek dikeyler** için genişletildi:

```sql
create table businesses (
  id                  uuid primary key default gen_random_uuid(),
  category_id         uuid not null references categories(id),   -- §80: taxi dışı dikeyler için
  business_name       text not null,
  name_normalized     text not null,        -- unaccent+lower+trim, duplicate tespiti (§52)
  slug                text not null unique,
  description         text,
  phone_e164          text,                 -- KANONİK: +905551112233 (§53)
  phone_display       text,                 -- gösterim: 0555 111 22 33
  whatsapp_e164       text,                 -- NULL ise WhatsApp butonu GÖSTERİLMEZ (§48)
  address             text,
  city                text not null default 'Kütahya',
  district            text,
  neighborhood        text,
  geo                 geography(Point,4326),-- lat/lon yerine; "yakınımdaki" için
  website             text,
  google_maps_url     text,
  plan                business_plan not null default 'free',
  status              business_status not null default 'pending',
  verification_status verification_status not null default 'unverified',
  source_type         source_type not null,          -- §20 zorunlu
  source_note         text,                          -- "OSM node 3776221854" / "durak levhası fotoğrafı"
  last_verified_at    timestamptz,                   -- §41 güven sinyali
  verified_by         uuid references profiles(id),
  owner_id            uuid references profiles(id),
  claimed_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
```

**`phone_e164` NULL olabilir ve bu kasıtlıdır.** Telefonu doğrulanmamış işletme, telefonsuz
yayınlanır ve "Bu durağın numarası bizde yok — sahibiyseniz ekleyin" CTA'sı gösterilir.
Uydurma numara **asla** yazılmaz (§20).

**`geo` neden `geography` (PostGIS)?** "Yakınımdaki taksiler" (§49) için `ST_DWithin` +
GIST index doğru araçtır. Ham lat/lon ile Haversine'i uygulama katmanında hesaplamak
index kullanamaz ve ileride yavaşlar. PostGIS Supabase'de hazır gelir; ek bağımlılık yok.

**`category_id` neden şimdi?** §80 (restoran, kuaför, oto servis…) için. Şimdi bir kolon,
sonra veri migrasyonu. MVP'de tek satır: `taksi`. Bu overengineering değil, ucuz sigorta.

### Diğer tablolar

| Tablo                   | Amaç                                     | Kritik nokta                                   |
| ----------------------- | ---------------------------------------- | ---------------------------------------------- |
| `categories`            | dikey (MVP: sadece `taksi`)              |                                                |
| `profiles`              | Auth kullanıcı profili, `role`           | `id` = `auth.users.id`                         |
| `services`              | 7/24, havalimanı, şehirlerarası…         | `slug` unique                                  |
| `business_services`     | M2M                                      | PK(business_id, service_id)                    |
| `locations`             | şehir/ilçe/mahalle/landmark, `parent_id` | hiyerarşi; §42 internal linking omurgası       |
| `business_locations`    | M2M — hizmet bölgeleri                   |                                                |
| `business_hours`        | çalışma saatleri                         | **yalnızca doğrulanmışsa satır yazılır** (§75) |
| `business_media`        | Storage path + alt_text + sort_order     |                                                |
| `claims`                | sahiplenme talepleri                     | `unique(business_id) where status='approved'`  |
| `reviews`               | V1'de **yazma kapalı**, şema hazır       | §17                                            |
| `analytics_events`      | ham event                                | `created_at` üzerinde BRIN index               |
| `analytics_daily`       | günlük rollup                            | dashboard bunu okur, ham tabloyu değil         |
| `business_slug_history` | eski slug → 301                          | §64                                            |
| `landing_pages`         | SEO landing page tanımları               | §31 thin content kapısı                        |

### `analytics_events` — ölçeklenme kararı

Dashboard "bu ay 247 görüntülenme" derken ham tabloyu `count(*)` ile taramaz. Gecelik bir
cron (`pg_cron`) `analytics_daily(business_id, day, event_type, count)` rollup'ını üretir;
dashboard bunu okur. Ham event'ler **90 gün** sonra silinir (KVKK veri minimizasyonu, §56).

### `landing_pages` — thin content'e karşı yapısal kapı

Landing page'ler koda gömülmez, tabloda tanımlanır:
`(slug, title, h1, intro, location_id?, service_id?, min_business_count, is_indexable)`.
Bir view, o sayfaya düşen **gerçek aktif işletme sayısını** hesaplar. Sayı `min_business_count`
(varsayılan **3**) altındaysa sayfa `noindex` alır ve sitemap'e **girmez**. Böylece §31 ve §75
bir "dikkat edelim" temennisi değil, **veritabanı seviyesinde uygulanan bir kural** olur.

---

## 7. RLS Modeli

RLS **tüm tablolarda açık**, istisnasız. `service_role` anahtarı frontend'e **hiçbir koşulda**
girmez; yalnızca migration script'lerinde ve (gerekirse) Edge Function içinde kullanılır.

| Rol           | businesses                          | claims                                | analytics_events   | profiles     |
| ------------- | ----------------------------------- | ------------------------------------- | ------------------ | ------------ |
| anon          | `select` where `status='active'`    | —                                     | `insert` (kısıtlı) | —            |
| authenticated | + kendi `owner_id`'si için `update` | kendi `user_id`'si: `select`,`insert` | `insert`           | kendi satırı |
| admin         | tümü                                | tümü                                  | `select`           | tümü         |

**Admin kontrolü nasıl?** `profiles` üzerinde `role='admin'` okuyan bir `security definer`
fonksiyon (`public.is_admin()`) — policy içinde `profiles`'a doğrudan select yapmak sonsuz
özyineleme üretir; bu bilinen tuzaktan kaçınılacak.

**Owner update'i sınırlıdır.** İşletme sahibi `status`, `verification_status`, `plan`,
`owner_id`, `source_type` kolonlarını **değiştiremez**. Bu, kolon bazlı `GRANT` + bir
`BEFORE UPDATE` trigger ile iki kez korunacak.

**`analytics_events` insert'i istismara açıktır** (anon insert). Önlemler: `event_type` enum'a
kısıtlı, `business_id` mevcut ve aktif olmalı, serbest metin alanı yok, `metadata` boyut limiti,
aynı `session_id`+`business_id`+`event_type` için kısa pencerede tekrar sayılmaz. Kötüye
kullanım görülürse Faz 11'de Edge Function + rate limit eklenecek. **anon'a `select` verilmez** —
rakip bir işletmenin verisi okunamaz.

---

## 8. URL Haritası

```
/                                   ana sayfa
/taksi                              tüm taksiler (ItemList)
/taksi/:slug                        işletme detayı (canonical)
/bolge/:slug                        lokasyon sayfası (merkez, ilçe, mahalle)
/hizmet/:slug                       hizmet sayfası (7/24, havalimanı…)
/rehber/:slug                       rehber içerikleri
/isletme-ekle                       "İşletmemi Yayınla"
/taksi/:slug/sahiplen               claim akışı
/giris  /kayit                      auth
/panel/**                           işletme sahibi paneli (noindex)
/admin/**                           admin (noindex)
/gizlilik  /kvkk  /kullanim-kosullari  /iletisim  /hakkinda
/sitemap.xml  /robots.txt  /llms.txt
```

**SEO landing page'leri** `landing_pages` tablosundan gelir ve kök seviyede yaşar:
`/kutahya-taksi`, `/kutahya-taksi-numaralari`, `/kutahya-724-taksi`, `/kutahya-gece-taksi`,
`/kutahya-otogar-taksi`, `/kutahya-havalimani-taksi`, `/zafer-havalimani-taksi`,
`/kutahya-sehirlerarasi-taksi`, `/kutahya-universite-taksi`, `/kutahya-hastane-taksi`.

**Canonical kararı (dikkat):** `/kutahya-taksi` ile `/taksi` aynı içeriği gösterme riski taşır.
Karar: `/taksi` **listenin canonical'ı**; `/kutahya-taksi` ancak gerçekten farklı bir kullanıcı
niyetini karşılayan ayrı içerikle (farklı H1, intro, sıralama, SSS) yaşarsa ayrı sayfa olur,
aksi halde `/taksi`'ye **301** verir. Karar Faz 4'te içerik netleşince kesinleşir;
**iki URL aynı içerikle indekslenmeyecek.**

Slug değişiminde `business_slug_history` üzerinden **301** verilir. Arşivlenen işletme **410**
döner (§64) — 404 değil, çünkü kalıcı kaldırma sinyali daha nettir.

---

## 9. SEO Mimarisi

- `core/seo/seo.service.ts` — her route'ta title, description, canonical, OG, Twitter, robots.
  Route resolver'ları veriyi çektikten **sonra** çağrılır ki SSR HTML'inde doğru meta bulunsun.
- `core/schema/` — JSON-LD üreticileri. HTML'de görünmeyen hiçbir bilgi schema'ya yazılmaz (§33, §63).
  - Her sayfa: `WebSite` + `Organization` (root'ta bir kez), `BreadcrumbList`
  - Liste sayfaları: `ItemList` → her item kendi canonical detay URL'sine `url` verir (§34)
  - Detay: `TaxiService` / `LocalBusiness` — yalnızca **gerçekten sahip olduğumuz** alanlarla.
    `aggregateRating` **yazılmaz** (review yok). `openingHours` yalnızca `business_hours` doluysa.
    `telephone` yalnızca `phone_e164` doluysa.
  - `FAQPage` yalnızca sayfada gerçek, görünür SSS varsa.
- `sitemap.xml` — sunucu route'u, veritabanından üretilir; `landing_pages.is_indexable` ve aktif
  işletme filtresine uyar. Büyüdüğünde index sitemap + alt sitemap'lere bölünür.
- `robots.txt` — statik değil, sunucu route'u (ortam bazlı: preview `Disallow: /`, prod açık).
  AI crawler'lar **varsayılan olarak engellenmez** (§35). Ayırt edilecek gruplar:
  arama/erişim botları (`OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`,
  `PerplexityBot`) **allow**; eğitim botları (`GPTBot`, `CCBot`, `Google-Extended`,
  `Applebot-Extended`) proje sahibinin tercihi — hedef görünürlük olduğu için varsayılan **allow**.
  Bu liste Faz 5'te güncel resmî dokümantasyonla tekrar doğrulanacak.

---

## 10. GEO / AI Katmanı

- Kritik içerik **server-rendered HTML'de** bulunur; JS ile gizlenmez (§39).
- `/llms.txt` — sunucu route'u, veritabanından üretilir; site tanımı + ana sayfalar + aktif
  işletme profilleri. Görünürlük garantisi olarak **değerlendirilmez** (§40).
- Güven sinyalleri yalnızca doğruysa render edilir (§41):
  - `last_verified_at` → "Son doğrulama: 8 Eylül 2026"
  - `verification_status='owner_claimed'` → "İşletme sahibi tarafından doğrulandı"
  - `source_type` → "Kaynak: kamuya açık durak bilgisi"

  Üçü de **veriden** gelir; şablonda sabit metin yoktur.

- Entity ilişkileri hem HTML linki hem `areaServed` / `sameAs` ile ifade edilir (§42).

---

## 11. Analytics Mimarisi

Kendi sistemimiz (§5). Üçüncü parti analytics MVP'de yok.

- `session_id`: `crypto.randomUUID()`, `sessionStorage`'da; **IP ve user-agent saklanmaz**.
- Bot filtresi: event'ler yalnızca tarayıcıda, hydration sonrası tetiklenir; SSR render'ı ve
  bilinen crawler'lar event üretmez. Böylece "247 görüntülenme" gerçek insan sayısına yakın olur.
- `call_click` yalnızca **tıklama** olarak kaydedilir; görüşme gerçekleşti iddiası yok (§29).
- Event'ler `sendBeacon` ile gönderilir (navigasyonu bloklamaz, INP'yi etkilemez).
- KVKK: PII yok, IP yok, çerez tabanlı kalıcı takip yok (§56).

---

## 12. Güvenlik ve KVKK

- `SUPABASE_URL` + `SUPABASE_ANON_KEY` bundle'a girer — bu **normaldir**, güvenlik RLS'tedir.
- `SUPABASE_SERVICE_ROLE_KEY` **asla** frontend'e, `environment.ts`'e veya git'e girmez.
  Faz 11'de bundle'da secret taraması yapılacak (§66).
- `.env` gitignore'da; `.env.example` repo'da.
- **KVKK — açıkça belirtilmesi gereken risk:** Şahıs işletmesi taksicinin cep telefonu numarası
  **kişisel veridir**. Kamuya açık olması işlemeyi otomatik meşru kılmaz. Uygulanacak asgari
  önlemler: her profilde görünür **"Bu profilin kaldırılmasını talep et"** bağlantısı, aydınlatma
  metni, veri kaynağının kayıtlı olması (`source_type`, `source_note`), talep üzerine hızlı
  kaldırma. **Bu bir hukuki görüş değildir; yayına çıkmadan önce KVKK uyumu için hukuki inceleme
  alınmalıdır** (§56).

---

## 13. Performans Bütçesi (§44)

| Metrik                         | Hedef (mobil, 4G) |
| ------------------------------ | ----------------- |
| LCP                            | < 2.0 s           |
| CLS                            | < 0.05            |
| INP                            | < 200 ms          |
| İlk JS (public sayfalar, gzip) | < 120 KB          |

Uygulama: kritik içerik SSR HTML'de; görseller Supabase Storage transform ile WebP/AVIF +
`srcset` + `width`/`height` (CLS); `NgOptimizedImage`; hero görseli `priority`; harita
kütüphanesi **yok** (§50 — "Yol Tarifi" harici link).

---

## 14. Ortam Değişkenleri

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # yalnızca lokal script / CI, ASLA client
SITE_URL=                       # canonical/sitemap tabanı; domain alınınca dolar
ENVIRONMENT=development|preview|production
NG_ALLOWED_HOSTS=               # SSR host doğrulaması; özel domain'de zorunlu
```

**Mekanizma:** Angular build `.env` okumaz. `scripts/generate-env.mjs`, `process.env`
(Vercel/CI) ve `.env` (lokal) değerlerinden `src/environments/environment.generated.ts`
üretir; bu dosya gitignore'dadır ve `prebuild`/`prestart`/`pretest` script'leri onu her
zaman yeniden üretir. Kod her zaman `@env` üzerinden import eder.

`service_role` anahtarı bu script tarafından **hiç okunmaz** — client'a sızmamasının
tek güvenilir yolu onu bu yola hiç sokmamaktır. Script ayrıca anon key alanına
yanlışlıkla service_role konursa build'i durdurur.

**`SITE_URL` production'da boşsa build bilerek durur.** Canonical/sitemap/OG mutlak URL
gerektirir; `localhost` yazmak sessiz bir indeksleme felaketi olurdu.

---

## 15. Değerlendirilip Reddedilen Alternatifler

| Alternatif                         | Neden reddedildi                                                      |
| ---------------------------------- | --------------------------------------------------------------------- |
| Tam prerender (SSG)                | İçerik tazeliği admin onayına bağlı; her onayda redeploy sürdürülemez |
| Ayrı NestJS/Express API            | Supabase + RLS yeterli; üçüncü katman gereksiz karmaşıklık (§82)      |
| NgRx / global store                | Signals + resolver yeterli; MVP'de state karmaşıklığı yok             |
| Public yolda `supabase-js`         | TransferState kaçağı + bundle şişmesi (bkz. §4)                       |
| Angular Material                   | Tasarım kimliğini kısıtlar, bundle ağır; kendi token + UI seti (§45)  |
| Leaflet / Google Maps JS           | §50 — MVP'de harita yok, harici "Yol Tarifi" linki yeterli            |
| Google Maps verisini çekmek        | ToS ihlali + yeniden yayın hakkı yok; §75 ile de çelişir              |
| lat/lon kolonları (PostGIS'siz)    | "Yakınımdaki" sorgusu index kullanamaz                                |
| 3. parti analytics (GA4/Plausible) | §5 kendi event sistemimizi istiyor; KVKK yüzeyi daha küçük            |
