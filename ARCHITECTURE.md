# ARCHITECTURE.md — Kütahya Taksi Ağı

> Durum: **FAZ 5 tamamlandı.** Bu belge mimari kararları ve gerekçelerini içerir; her fazda
> güncellenir. Güncel faz durumu için: [PROJECT_PLAN.md](./PROJECT_PLAN.md)
> Son güncelleme: 9 Eylül 2026

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

**Faz 2'de uygulandı:** `core/data/postgrest.client.ts` (ince `HttpClient` sarmalayıcı),
`business.repository.ts`, `location.repository.ts`, `service.repository.ts`. Repository'ler
`status='active'` filtresini KENDİLERİ eklemiyor — RLS zaten yalnızca aktif işletmeyi döndürür;
filtreyi iki yerde tutmak ileride sessiz tutarsızlık üretirdi. Tipler elle yazılmıyor,
`npm run db:types` ile Supabase şemasından üretiliyor (`database.types.ts`), `models.ts` bunlardan
türetiyor — şema değişince derleme hatası alınır, sessiz uyuşmazlık olmaz.

### KRİTİK BULGU (Faz 3) — Angular'ın yerleşik TransferState özelliği bu sürümde ÇALIŞMIYOR

`provideClientHydration(withHttpTransferCacheOptions(...))` yukarıda "bedava gelir" deniyordu;
Faz 3'te curl ile SSR HTML'inin `ng-state` bloğu incelenince **hiçbir HTTP yanıtının
TransferState'e yazılmadığı** görüldü — tarayıcı her isteği hydration'da tekrar çekiyordu.

**Kök neden doğrulandı** (derlenmiş `@angular/platform-server` 22.1.5 kaynağı okunarak):
`globalThis.ngServerMode`'u `true` yapması gereken kod hem `platformServer()` hem
`provideServerRendering()` içinde **ölü kod** olarak derleniyor
(`const noServerModeSet = false; if (noServerModeSet) {...}` / `if (false) {...}`).
`withHttpTransferCacheOptions`'ın sunucu tarafı yazma dalı tam olarak bu bayrağın arkasında
olduğu için hiçbir zaman çalışmıyor. `@angular/ssr`'ın kendi `provideServerRendering`'i de
içeride bu aynı platform-server fonksiyonunu çağırıyor, yani bu **proje özgü bir yapılandırma
hatası değil** — bu satırları kullanan her Angular 22.1.5 SSR uygulamasını etkiliyor
(muhtemelen Angular'ın açık `#64846` "Simplified platform detection helpers" refactor'ının
yarım kalmış bir ara durumu).

**Çözüm — elle TransferState:** `postgrest.client.ts` artık Angular'ın `TransferState`
API'sini (`makeStateKey`/`set`/`get`/`hasKey`/`remove`) doğrudan, kendi `list()`/`single()`/`rpc()`
metotları içinde kullanıyor: sunucuda yanıtı yazıyor, tarayıcıda bir kez okuyup siliyor (sonraki
navigasyonlar taze veri ister). `insert()` bilerek kapsam dışı — yazma işlemi cache'lenip tekrar
oynatılmaz. Bu, genel bir `HttpInterceptor` DEĞİL; yalnızca bu istemcinin kendi metotları için
çalışan, dar kapsamlı bir çözüm.

**Kanıt:** `curl` ile SSR HTML'inin `ng-state` bloğunda `pgrest:["list","locations",...]`
anahtarlı gerçek veri görüldü; `postgrest.client.spec.ts` iki testle bunu kanıtlıyor —
sunucu tarafı gerçekten `TransferState.set()` çağırıyor, tarayıcı tarafı önbellek doluyken
**hiçbir HTTP isteği yapmıyor** ve kaydı bir kullanımdan sonra siliyor.

Angular bu regresyonu düzelttiğinde iki mekanizma (yerleşik + elle) çakışmaz — farklı anahtar
alanları kullanırlar, zararsızca birlikte var olurlar. `app.config.ts`'teki
`withHttpTransferCacheOptions` çağrısı bu yüzden kaldırılmadı.

### `supabase-js` nerede kullanılacak?

Yalnızca **lazy-loaded** `auth`, `dashboard`, `admin`, `claim` feature'larında — Auth (session
yönetimi, token refresh), Storage (fotoğraf upload) ve yazma işlemleri için. Public kullanıcı
bu chunk'ı hiç indirmez.

### Katman şekli

```
core/data/
  postgrest.client.ts      # PostgREST + HttpClient, SSR-safe, elle TransferState'li
  database.types.ts        # `npm run db:types` ile üretilir, elle düzenlenmez
  models.ts                 # database.types.ts'ten türetilen uygulama tipleri
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

> **Durum: Faz 2'de uygulandı.** Proje `kutahyataksi` (`ierfpvxzknfoyubpnzws`, eu-west-1,
> Postgres 17.6). Aşağıdaki şema `supabase/migrations/`'da 7 migration dosyası halinde yaşıyor
> ve `supabase db push` ile temiz uygulandı — burada tasarım niyeti kalıcı olarak dursun diye
> tekrarlanıyor, ama tek doğruluk kaynağı migration dosyalarıdır.

PostgreSQL 17 (Supabase). Uzantılar: `pgcrypto`, `postgis`, `pg_trgm`, `unaccent`
(hepsi `extensions` şemasına kurulu — Supabase konvansiyonu, kod `extensions.` ile nitelenir).

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

> **Durum: Faz 4'te uygulandı.**

```
/                                   ana sayfa
/taksi                              tüm taksiler (ItemList)
/taksi/:slug                        işletme detayı (canonical) — 301/410/404 çözümlemeli
/bolge                              bölge listesi
/bolge/:slug                        lokasyon sayfası (merkez, ilçe, mahalle, landmark)
/hizmet                             hizmet listesi
/hizmet/:slug                       hizmet sayfası (7/24, havalimanı…)
/isletme-ekle                       "İşletmemi Yayınla"
/taksi/:slug/sahiplen               claim akışı (Faz 7)
/panel/**                           işletme sahibi paneli (Client mode, her koşulda noindex)
/hakkinda  /gizlilik                statik içerik (Prerender)
/:slug                              landing_pages'ten SEO sayfaları (§30) — DİĞER TÜM
                                     route'lardan SONRA tanımlı, aksi halde onları gölgeler
/sitemap.xml  /robots.txt           Express route'u, Angular değil
```

`/rehber/:slug` ve `/llms.txt` **bilerek henüz yok** — ilki gerçek araştırılmış içerik
gerektirir (§74, Faz 8+), ikincisi Faz 5'in kapsamı.

**SEO landing page'leri** `landing_pages` tablosundan gelir ve kök seviyede yaşar (Faz 2'de
seed edildi, hepsi `is_published=false`): `/kutahya-724-taksi`, `/kutahya-havalimani-taksi`,
`/zafer-havalimani-taksi`, `/kutahya-sehirlerarasi-taksi`, `/kutahya-otogar-taksi`,
`/kutahya-universite-taksi`. `/kutahya-taksi` ve `/kutahya-gece-taksi` gibi bazı §30 örnekleri
**bilerek eklenmedi** — bkz. aşağıdaki canonical kararı.

**Canonical kararı — KESİNLEŞTİ (Faz 4):** Her landing page **kendi URL'sine self-canonical'dır**;
`/taksi`'ye yönlendirilmez. Gerekçe: bir landing page ancak `landing_pages_has_target` (en az bir
hedef) VE `min_business_count` eşiğini (varsayılan 3, `landing_page_stats.is_indexable`) geçtiğinde
gösterilir/indexlenir — yapısal olarak `/taksi`'nin bir kopyası OLAMAZ, çünkü kendi h1/intro'su ve
daraltılmış bir işletme alt kümesi vardır. Bu yüzden 301 yerine **eşik tabanlı `noindex`** tercih
edildi: eşiği geçmeyen sayfa `noindex, follow` alır (yine de erişilebilir, internal linking bozulmaz)
ve sitemap'e girmez; eşiği geçince otomatik `index, follow` olur. `/kutahya-taksi` gibi `/taksi`
listesiyle GERÇEKTEN örtüşebilecek genel bir sayfa bu yüzden seed'e **eklenmedi** — böyle bir sayfa
gerekirse, `/taksi`'den GERÇEKTEN farklı bir açı (ör. filtrelenmiş/özet bir görünüm) olmadan
açılmamalı.

Slug değişiminde **301 + `Location` header** döner; arşivlenen işletme **410**, hiç var olmamış
**404** (§64) — üçü de `resolve_missing_business_slug` SQL fonksiyonu (SECURITY DEFINER,
Faz 4 migration'ı) ile TEK sorguda ayrıştırılır ve `taxi-detail-page.ts`'te `RESPONSE_INIT.status`

- `RESPONSE_INIT.headers.Location` üzerinden uygulanır. Bu ek sorgu yalnızca `bySlug()` `null`
  döndükten SONRA (nadir yol) çalışır — normal sayfa görüntülemede performans maliyeti yoktur.

---

## 9. SEO Mimarisi

> **Durum: Faz 4'te uygulandı.** `curl` ile SSR HTML'ine karşı 22 noktalı smoke test ile
> doğrulandı (canonical, JSON-LD, robots, sitemap, 404/301/410 — bkz. PROJECT_PLAN.md).

- `core/seo/seo.service.ts` — **her sayfa** kendi `constructor()`'ında (statik sayfalar) veya
  veri geldiğinde (`effect()` içinde, dinamik sayfalar) `setPage()` çağırır: title, description,
  canonical `<link>`, OG, Twitter, robots TEK metotta birlikte ayarlanır. `app.routes.ts`'teki
  eski statik `title:` alanları KALDIRILDI — iki ayrı kaynak (route config + servis) artık yok.
  Robots kararı üç durumludur (`index,follow` / `noindex,follow` / `noindex,nofollow`) — bkz.
  servis içi yorum.
- `core/schema/schema.service.ts` — JSON-LD `<script>` enjeksiyonu. HTML'de görünmeyen hiçbir
  bilgi schema'ya yazılmaz (§33, §63). SPA navigasyonunda eski sayfanın script'leri otomatik
  temizlenir (yeni sayfa tekrar `set()` etmediği id'ler bir sonraki `NavigationEnd`'de silinir);
  `Organization`/`WebSite` gibi site geneli bloklar `persistent: true` ile bu temizlikten muaftır.
  - `App` kökünde bir kez: `Organization` + `WebSite`.
  - Liste sayfaları (`/taksi`, `/bolge/:slug`, `/hizmet/:slug`, landing page'ler): `ItemList` —
    yalnızca sonuç varsa yazılır, boşsa `remove()` edilir; her item kendi canonical detay
    URL'sine `url` verir (§34).
  - Detay sayfaları: `BreadcrumbList` + `LocalBusiness`/`TaxiService` (`core/schema/builders.ts`,
    saf fonksiyonlar — DOM'suz test edilebilir). `aggregateRating` **yazılmaz** (review yok, §17).
    `openingHoursSpecification` yalnızca `business_hours` doluysa (§75). `telephone` yalnızca
    `phone_e164` doluysa (§20).
  - `FAQPage` henüz yok — sayfalarda gerçek, görünür SSS içeriği olmadan eklenmeyecek.
- `/sitemap.xml` — **Angular route/component DEĞİL**, `server.ts`'te Angular'dan ÖNCE tanımlı
  düz bir Express route'u (`src/seo/sitemap.ts`). Anon anahtarla PostgREST'e gider (service_role
  gerekmez — yalnızca zaten public olan veriyi listeler). Aktif işletmeler + tüm bölge/hizmet
  taksonomi sayfaları + yalnızca `landing_page_stats.is_indexable=true` olan landing page'ler.
  `/panel`, `/isletme-ekle` gibi kimlik doğrulama arkası veya işlevsiz sayfalar sitemap'te YOK.
- `/robots.txt` — aynı şekilde düz Express route'u, ortam bazlı: production DIŞI **her zaman**
  `Disallow: /` (bu, `app.ts`'teki `noindex` meta etiketinin robots.txt seviyesindeki eşleniği —
  iki bağımsız güvenlik ağı). Production'da `Allow: /` + `Sitemap:` direktifi. Bot bazlı ince ayar
  (arama/erişim botlarını eğitim botlarından ayırmak — `OAI-SearchBot` vb.) Faz 5'e ertelendi;
  güncel resmî dokümantasyon o zaman tekrar doğrulanacak.

---

## 10. GEO / AI Katmanı

> **Durum: Faz 5'te uygulandı.**

- Kritik içerik **server-rendered HTML'de** bulunur; JS ile gizlenmez (§39). Bu, Faz 1'den
  beri her fazın `curl` tabanlı smoke testleriyle (JS hiç çalıştırılmadan) doğrulana geldi —
  Faz 5'e özel yeni bir mekanizma değil, zaten var olan bir mimari özelliğin denetimi.
- `/llms.txt` — `server.ts`'te Angular'dan önce tanımlı düz bir Express route'u
  (`src/seo/llms-txt.ts`, `sitemap.ts` ile aynı desen — saf fonksiyonlar + anon PostgREST okuma).
  Site tanımı + ana sayfalar + **gerçek** bölge/hizmet/aktif işletme listesi. Boş bölümler
  sessizce atlanmaz, "henüz yayınlanmış içerik yok" yazar (§74, R1 ile dürüst). Görünürlük
  garantisi olarak **değerlendirilmez** (§40) — dosyanın kendi metninde de bu açıkça yazılı.
- AI crawler politikası **birincil kaynaklardan doğrulandı** (OpenAI/Anthropic/Google/Perplexity'nin
  kendi dokümantasyonu — bkz. PROJECT_PLAN.md Faz 5). `robots.txt` artık her arama/erişim botu
  (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User) VE
  her eğitim botu (GPTBot, ClaudeBot, Google-Extended) için AYRI, açık `Allow: /` satırı taşıyor —
  `User-agent: *` zaten hepsini kapsasa da, bu açıklık niyeti denetlenebilir kılıyor.
- Güven sinyalleri yalnızca doğruysa render edilir (§41) — Faz 3'te uygulandı, Faz 5'te değişmedi:
  - `last_verified_at` → "Doğrulandı — 8 Eylül 2026"
  - `verification_status='owner_claimed'` → "İşletme sahibi tarafından doğrulandı"
  - `source_type` → "Kaynak: kamuya açık durak bilgisi"

  Üçü de **veriden** gelir; şablonda sabit metin yoktur.

- **Entity ilişkileri iki yönlü.** Bölge/hizmet sayfaları zaten işletmelere link veriyordu
  (Faz 3); Faz 5'te eksik olan TERS yön eklendi — işletme detay sayfası artık kendi
  `business_services`/`business_locations` ilişkilerini okuyup `/hizmet/:slug` ve `/bolge/:slug`
  sayfalarına GERİ link veriyor (§42'nin "Zümrüt Taksi → Kütahya Merkez → 7/24 Taksi" zinciri artık
  gerçekten tam). `taxi-detail-page.spec.ts` bir işletmenin gerçek hizmet/bölge linklerini
  render ettiğini doğruluyor.

---

## 11. Analytics Mimarisi

Kendi sistemimiz (§5). Üçüncü parti analytics MVP'de yok. Uygulama: `src/app/core/analytics/`
(`AnalyticsService`, `bot-detection.ts`), `src/app/core/data/analytics.repository.ts`.

- `session_id`: `crypto.randomUUID()`, `sessionStorage`'da; **IP ve user-agent saklanmaz**.
- Bot filtresi (`isLikelyBot()`): event'ler yalnızca tarayıcıda, `isPlatformBrowser` sonrası
  tetiklenir; SSR render'ı hiç event üretmez. Ayrıca bilinen crawler user-agent imzaları (Googlebot,
  GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot, vb. — bkz.
  `bot-detection.ts`) elenir; bu kesin bir güvenlik sınırı değil, en iyi çaba istatistik temizliğidir.
- `call_click` yalnızca **tıklama** olarak kaydedilir; görüşme gerçekleşti iddiası yok (§29).
- KVKK: PII yok, IP yok, çerez tabanlı kalıcı takip yok (§56).
- `rollup_analytics_daily()` (gece 03:00 UTC) ve `prune_analytics_events()` (03:30 UTC)
  `pg_cron` ile zamanlanmıştır (`supabase/migrations/20260909110000_analytics_cron.sql`) — 90 günden
  eski ham event silinir, günlük özet kalıcıdır.
- Panel istatistik sorguları (`AnalyticsRepository.dailyStats()`) RLS'e güvenir
  (`analytics_daily_select_own` — yalnızca sahip/admin); Faz 6'da yazıldı ama HENÜZ HİÇBİR UI
  tarafından çağrılmıyor — çağıran, Faz 7'nin auth/claim sistemidir (bkz. `dashboard-page.ts` yorumu).

### KRİTİK KARAR (Faz 6) — `sendBeacon` DEĞİL, `fetch(..., {keepalive:true})`

Master prompt §11 `sendBeacon` istiyordu; uygulamada bundan VAZGEÇİLDİ. Sebep: `sendBeacon` özel
HTTP başlığı ayarlayamaz (yalnızca `Content-Type` çıkarımı yapılır — [MDN][beacon-headers]), ancak
PostgREST HER istekte `apikey`/`Authorization` başlığı zorunlu kılar ve buna sorgu dizesi tabanlı bir
alternatif sunmaz (o yalnızca Supabase Realtime'a özgüdür). `fetch(url, {keepalive:true, headers})`
`sendBeacon` ile AYNI garantiyi verir — sayfa kapansa/gezinilse bile istek tamamlanır — ve başlık
desteğini korur. Bu, TransferState (§4) ve `allowedHosts` (§3) bulgularıyla aynı desen: master
prompt'un literal talimatı teknik bir kısıtla çelişince, sapma burada açıkça gerekçelendirilir.

[beacon-headers]: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon

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
yanlışlıkla gizli anahtar konursa build'i durdurur.

**`SITE_URL` production'da boşsa build bilerek durur.** Canonical/sitemap/OG mutlak URL
gerektirir; `localhost` yazmak sessiz bir indeksleme felaketi olurdu.

**Faz 2'de öğrenildi — Supabase anahtar formatı değişti.** Proje yeni `sb_publishable_...`
(public) / `sb_secret_...` (gizli) formatını kullanıyor; eski JWT tabanlı `anon`/`service_role`
adlandırması hâlâ geçerli ama yeni projelerde bu prefix'ler görülüyor. `generate-env.mjs`'deki
sızıntı koruması ikisini de tanır (`service_role` metnini VEYA `sb_secret_` önekini yakalar).

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
