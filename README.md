# Kütahya Taksi Ağı

Kütahya'daki taksi işletmelerini tek yerde toplayan, SEO ve AI arama görünürlüğü
odaklı yerel işletme rehberi.

Müşteri arama motorundan siteye gelir, taksileri listeler, bir profili açar ve
doğrudan arar / WhatsApp'a geçer / yol tarifi alır. İşletme sahibi profilini
ücretsiz sahiplenir, bilgilerini yönetir ve kaç kişinin iletişim butonlarına
tıkladığını görür.

- Mimari kararlar ve gerekçeleri: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Faz planı, riskler ve durum: [PROJECT_PLAN.md](./PROJECT_PLAN.md)

**Durum:** FAZ 1 (Project Foundation) tamamlandı. Supabase henüz bağlı değil (FAZ 2).

---

## Teknoloji

| Katman   | Seçim                                                        |
| -------- | ------------------------------------------------------------ |
| Frontend | Angular 22 — standalone, zoneless, signals, lazy routes      |
| Render   | Angular SSR, `outputMode: server` + route bazlı `RenderMode` |
| Backend  | Supabase (PostgreSQL + Auth + Storage + RLS) — FAZ 2         |
| Hosting  | Vercel (Node serverless function + edge CDN)                 |
| Test     | Vitest                                                       |
| Lint     | ESLint + angular-eslint, Prettier                            |

Stil için preprocessor yok: CSS custom properties ile design token'lar
(`src/styles/tokens.css`). UI kütüphanesi yok.

---

## Kurulum

Gereksinimler: Node.js 20+ (geliştirme 24.x ile yapıldı), npm 10+.

```bash
npm install
cp .env.example .env    # değerleri doldurun
npm start               # http://localhost:4200
```

`npm start` ve `npm run build`, öncesinde otomatik olarak `scripts/generate-env.mjs`
çalıştırır.

---

## Ortam değişkenleri

`.env` git'e **girmez**. Şablon için [`.env.example`](./.env.example).

| Değişken                    | Zorunlu                 | Açıklama                                                                           |
| --------------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | FAZ 2'den sonra         | Supabase proje adresi                                                              |
| `SUPABASE_ANON_KEY`         | FAZ 2'den sonra         | Public anon anahtar — bundle'a girer, bu normaldir (güvenlik RLS'te)               |
| `SUPABASE_SERVICE_ROLE_KEY` | hayır                   | **Yalnızca** lokal script/CI. Client'a asla girmez, `generate-env` bunu hiç okumaz |
| `SITE_URL`                  | production'da **evet**  | Canonical/sitemap/OG için mutlak taban adres, sonunda `/` yok                      |
| `ENVIRONMENT`               | hayır                   | `development` \| `preview` \| `production`                                         |
| `NG_ALLOWED_HOSTS`          | özel domain'de **evet** | SSR host doğrulaması — aşağıya bakın                                               |

### İki tuzak

**1. `SITE_URL` production'da boş olamaz.** Boşsa build bilerek durur. Canonical'ın
`localhost` olması sessizce indekslemeyi bozardı.

**2. `NG_ALLOWED_HOSTS` yanlışsa site komple 400 döner.** Angular SSR, SSRF'e karşı
istek hostname'ini doğrular. Vercel'de `VERCEL_URL` /
`VERCEL_PROJECT_PRODUCTION_URL` otomatik geldiği için preview deployment'ları
kendiliğinden çalışır; **özel domain bağlandığında** `NG_ALLOWED_HOSTS` mutlaka
tanımlanmalıdır (`kutahyataksi.com,www.kutahyataksi.com`).

Lokalde SSR sunucusunu elle çalıştırırken:

```bash
NG_ALLOWED_HOSTS=localhost npm run serve:ssr
```

---

## Komutlar

| Komut                             | Ne yapar                                             |
| --------------------------------- | ---------------------------------------------------- |
| `npm start`                       | Geliştirme sunucusu (SSR açık)                       |
| `npm run build`                   | Production build → `dist/kutahya-taksi-agi/`         |
| `npm run serve:ssr`               | Build edilmiş SSR sunucusunu çalıştırır              |
| `npm test`                        | Vitest                                               |
| `npm run lint` / `lint:fix`       | ESLint                                               |
| `npm run format` / `format:check` | Prettier                                             |
| `npm run env:generate`            | `.env` → `src/environments/environment.generated.ts` |

---

## Mimari özet

```
src/app/
  core/       config, errors  (ileride: data, supabase, seo, schema, analytics, guards)
  shared/     layout (header/footer), ui (spinner, skeleton, empty-state)
  features/   home, taxis, taxi-detail, business-submit, legal, dashboard, not-found
src/styles/   tokens.css, reset.css
src/environments/  ortam modeli + üretilen dosya (gitignore'da)
scripts/      generate-env.mjs
api/          Vercel serverless adapter
```

### Render modları

Her route'un modu `src/app/app.routes.server.ts` içinde tanımlıdır:

| Mod         | Nerede                             | Neden                                                                              |
| ----------- | ---------------------------------- | ---------------------------------------------------------------------------------- |
| `Server`    | `/`, `/taksi`, `/taksi/:slug`, 404 | İçerik veritabanından gelir ve taze kalmalı. CDN'de `s-maxage=300` ile cache'lenir |
| `Prerender` | `/hakkinda`, `/gizlilik`           | Veriden bağımsız, build zamanında sabitlenebilir                                   |
| `Client`    | `/panel`                           | SEO'ya konu değil, kimlik doğrulama arkasında                                      |

`app.routes.server.spec.ts`, her istemci route'unun bir sunucu karşılığı olduğunu
ve modların/başlıkların doğru olduğunu test eder — yeni route eklerken bu test
unutulan yapılandırmayı yakalar.

---

## Deployment (Vercel)

Angular SSR'ın Vercel'de **zero-config desteği yoktur**. Adapter olmadan Vercel
`index.html`'i statik servis eder ve `server.mjs` hiç çağrılmaz; site çalışıyor
görünür ama her sayfa boş kabuk olarak gelir. Bunu iki dosya çözer:

- `api/index.mjs` — Angular'ın `reqHandler`'ını Vercel Node runtime'ına bağlar
- `vercel.json` — statik dosyaları `dist/.../browser`'dan verir, kalan trafiği `/api`'ye yönlendirir

**Deploy sonrası SSR'ı mutlaka doğrulayın:**

```bash
curl -s https://<deployment>/taksi/deneme-slug-12345 | grep deneme-slug-12345
```

Çıktı boşsa SSR çalışmıyordur. Rastgele bir slug seçilmesi kasıtlıdır: prerender
edilmiş bir sayfa bu içeriği üretemez, dolayısıyla çıktı SSR'ın istek anında
çalıştığını kanıtlar.

Domain henüz alınmadı. Domain bağlandığında: `SITE_URL` ve `NG_ALLOWED_HOSTS`
güncellenir, `ENVIRONMENT=production` yapılır (bu, otomatik `noindex`'i kaldırır).

---

## Indeksleme koruması

Production dışı her ortam otomatik olarak `<meta name="robots" content="noindex, nofollow">`
alır (`src/app/app.ts`). Bu, `index.html`'e sabit yazılmadı — production'da silmeyi
unutma riski taşırdı. Preview deployment'larının indekslenmemesi bu şekilde
garanti altına alınır.

---

## Veri ilkesi

Uydurma işletme, telefon, adres, çalışma saati veya değerlendirme **oluşturulmaz**.
Her kaydın kaynağı (`source_type`, `source_note`) ve son doğrulama tarihi
veritabanında tutulur; profilde yalnızca gerçekten doğruysa güven rozeti gösterilir.
Telefonu doğrulanmamış işletme telefonsuz yayınlanır.

Ayrıntı ve veri toplama planı: [PROJECT_PLAN.md](./PROJECT_PLAN.md) §3 (R1).
