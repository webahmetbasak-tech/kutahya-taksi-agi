/**
 * Ortam değişkenlerinden `src/environments/environment.generated.ts` üretir.
 *
 * Neden bu yol seçildi?
 * - `.env` dosyası git'e girmez (§66). Angular build'i `.env` okumaz, bu yüzden
 *   değerleri build zamanında typed bir TS dosyasına yazıyoruz.
 * - Vercel'de `.env` yoktur; değişkenler `process.env` üzerinden gelir. Aynı script
 *   her iki ortamda da çalışır.
 * - Üretilen dosya gitignore'dadır; `prebuild`/`prestart` script'leri onu her zaman
 *   yeniden üretir, yani taze bir clone'da da build çalışır.
 *
 * service_role anahtarı BİLEREK okunmaz — client bundle'a girmemesi için tek
 * güvenilir yol, onu buraya hiç taşımamaktır.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = resolve(root, 'src/environments/environment.generated.ts');
const envFile = resolve(root, '.env');

/** `.env` dosyasını minimal şekilde ayrıştırır (bağımlılık eklememek için). */
function readDotEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

// process.env önceliklidir (Vercel/CI), .env yereldir.
const dotEnv = readDotEnv(envFile);
const read = (key) => (process.env[key] ?? dotEnv[key] ?? '').trim();

const environment = read('ENVIRONMENT') || 'development';
const production = environment === 'production';

let siteUrl = read('SITE_URL').replace(/\/+$/, '');
if (!siteUrl) {
  // Domain henüz alınmadı. Development'ta localhost makul; production'da
  // canonical'ın "localhost" olması sessiz bir SEO felaketi olurdu — bu yüzden
  // production'da boş SITE_URL build'i durdurur.
  if (production) {
    console.error(
      '\n[generate-env] HATA: ENVIRONMENT=production ama SITE_URL boş.\n' +
        'Canonical/sitemap/OpenGraph mutlak URL gerektirir; localhost yazılamaz.\n' +
        'Vercel > Settings > Environment Variables içinde SITE_URL tanımlayın.\n',
    );
    process.exit(1);
  }
  siteUrl = 'http://localhost:4200';
}

const supabaseUrl = read('SUPABASE_URL').replace(/\/+$/, '');
const supabaseAnonKey = read('SUPABASE_ANON_KEY');

// Faz 1'de Supabase henüz kurulmadı; eksik olması build'i durdurmaz ama
// production'da eksikse uyarı verir (Faz 2'den sonra hata olacak).
if (production && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn('[generate-env] UYARI: production build ama SUPABASE_URL/ANON_KEY boş.');
}

if (/service_role/i.test(supabaseAnonKey)) {
  console.error('\n[generate-env] HATA: SUPABASE_ANON_KEY alanına service_role anahtarı konmuş.\n');
  process.exit(1);
}

const banner = '// OTOMATİK ÜRETİLDİ — elle düzenlemeyin. Kaynak: scripts/generate-env.mjs';
const contents = `${banner}
// Üretim zamanı: ${new Date().toISOString()}

import type { AppEnvironment } from './environment.model';

export const generatedEnvironment: AppEnvironment = {
  environment: ${JSON.stringify(environment)},
  production: ${production},
  siteUrl: ${JSON.stringify(siteUrl)},
  supabaseUrl: ${JSON.stringify(supabaseUrl)},
  supabaseAnonKey: ${JSON.stringify(supabaseAnonKey)},
};
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, contents, 'utf8');

console.log(
  `[generate-env] environment=${environment} siteUrl=${siteUrl} ` +
    `supabase=${supabaseUrl ? 'ayarlı' : 'BOŞ'}`,
);
