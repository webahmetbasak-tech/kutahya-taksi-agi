import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { environment } from './environments/environment';
import { buildRobotsTxt, buildSitemapXml, fetchSitemapUrls } from './seo/sitemap';
import { buildLlmsTxt, fetchLlmsTxtData } from './seo/llms-txt';

const browserDistFolder = join(import.meta.dirname, '../browser');

/**
 * Angular SSR, SSRF'e karşı istek hostname'ini doğrular; tanınmayan host **400**
 * döner. Bu ayar yanlışsa site tamamen erişilemez hale gelir ve hata mesajı
 * nedeni açıklamaz — bu yüzden host listesi burada birden fazla kaynaktan
 * toplanır ve eksikse yüksek sesle uyarılır.
 *
 * Kaynaklar:
 * - `NG_ALLOWED_HOSTS` — elle verilen liste (virgülle ayrılmış). Özel domain buraya.
 * - `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` / `VERCEL_BRANCH_URL` — Vercel'in
 *   otomatik sağladığı deployment adresleri. Böylece preview deployment'ları
 *   ek yapılandırma olmadan çalışır.
 */
function resolveAllowedHosts(): string[] {
  const sources = [
    process.env['NG_ALLOWED_HOSTS'],
    process.env['VERCEL_PROJECT_PRODUCTION_URL'],
    process.env['VERCEL_URL'],
    process.env['VERCEL_BRANCH_URL'],
  ];

  const hosts = new Set<string>();
  for (const source of sources) {
    for (const part of (source ?? '').split(',')) {
      const host = part
        .trim()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '');
      if (host) {
        hosts.add(host);
      }
    }
  }

  return [...hosts];
}

const allowedHosts = resolveAllowedHosts();

if (allowedHosts.length === 0) {
  console.warn(
    '[server] NG_ALLOWED_HOSTS tanımlı değil ve Vercel değişkenleri de yok. ' +
      'Angular varsayılanı dışındaki her host 400 dönecek. ' +
      'Lokal geliştirmede: NG_ALLOWED_HOSTS=localhost',
  );
}

const app = express();
const angularApp = new AngularNodeAppEngine(allowedHosts.length > 0 ? { allowedHosts } : undefined);

/**
 * `/robots.txt` ve `/sitemap.xml` — Angular route/component DEĞİL, düz Express
 * route'ları (§35, §36). Angular'ın statik dosya sunumundan ve catch-all
 * render'ından ÖNCE tanımlanmaları kritiktir; aksi halde bunlara asla ulaşılmaz.
 *
 * Sitemap üretimi anon anahtarla PostgREST'e gider — service_role GEREKMEZ,
 * çünkü yalnızca zaten public olan veriyi listeler (bkz. sitemap.ts başlığı).
 */
app.get('/robots.txt', (_req, res) => {
  res
    .type('text/plain')
    .set('Cache-Control', 'public, max-age=0, s-maxage=3600')
    .send(buildRobotsTxt({ production: environment.production, siteUrl: environment.siteUrl }));
});

app.get('/sitemap.xml', async (_req, res, next) => {
  try {
    const urls = await fetchSitemapUrls({
      siteUrl: environment.siteUrl,
      supabaseUrl: environment.supabaseUrl,
      supabaseAnonKey: environment.supabaseAnonKey,
    });
    res
      .type('application/xml')
      .set('Cache-Control', 'public, max-age=0, s-maxage=1800, stale-while-revalidate=86400')
      .send(buildSitemapXml(urls));
  } catch (error) {
    // Sitemap üretilemezse sessizce boş dönmüyoruz — hata loglanır, 500 döner.
    console.error('[sitemap] üretim hatası:', error);
    next(error);
  }
});

/**
 * `/llms.txt` (§40) — AI ajanlarının site yapısını anlaması için önerilen,
 * ama RESMİ OLMAYAN bir konvansiyon. Görünürlük garantisi DEĞİLDİR (§38, §73).
 */
app.get('/llms.txt', async (_req, res, next) => {
  try {
    const data = await fetchLlmsTxtData({
      siteUrl: environment.siteUrl,
      supabaseUrl: environment.supabaseUrl,
      supabaseAnonKey: environment.supabaseAnonKey,
    });
    res
      .type('text/plain')
      .set('Cache-Control', 'public, max-age=0, s-maxage=1800, stale-while-revalidate=86400')
      .send(buildLlmsTxt(data));
  } catch (error) {
    console.error('[llms.txt] üretim hatası:', error);
    next(error);
  }
});

/**
 * Statik dosyalar hash'li isimlerle üretilir, bu yüzden bir yıl immutable
 * cache'lenebilir. `index: false` — kök isteği Angular'a bırakılır.
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/** Diğer tüm istekleri Angular render eder. */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Lokal geliştirme / `npm run serve:ssr` için sunucuyu başlat. Vercel'de bu blok
 * çalışmaz; `api/index.mjs` aşağıdaki `reqHandler`'ı kullanır.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/** Angular CLI ve Vercel adapter'ı tarafından kullanılan istek işleyici. */
export const reqHandler = createNodeRequestHandler(app);
