import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

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
