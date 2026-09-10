/**
 * Vercel'de "/" için `api/index.mjs` (SSR) yerine `index.csr.html`nin
 * doğrudan sunulmasını önler.
 *
 * Sorun: Vercel'in statik dosya sunumu, `vercel.json`daki rewrite kuralından
 * ÖNCE çalışıyor — `outputDirectory`de kök seviyede `index.csr.html` (Angular
 * CLI'nin ürettiği CSR-fallback belgesi) bulununca Vercel bunu "/" için
 * varsayılan doküman sayıyor ve rewrite'ı hiç değerlendirmiyor. Sonuç: "/"
 * her zaman boş `<app-root></app-root>` kabuğunu döndürüyordu, SSR hiç
 * çalışmıyordu (canlıda doğrulandı — `/taksi`, `/bolge` gibi diğer TÜM
 * rotalar doğru SSR ediyordu, yalnızca kök path etkileniyordu).
 *
 * Bu proje TÜM rotaları `api/index.mjs` üzerinden (Node SSR) sunuyor —
 * statik bir CSR-fallback dokümanına hiç ihtiyaç yok. `postbuild` ile bu
 * dosya build çıktısından silinir, böylece Vercel'in eşleşecek statik bir
 * dosyası kalmaz ve rewrite kuralı "/" için de devreye girer.
 */
import { existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'dist/kutahya-taksi-agi/browser/index.csr.html');

if (existsSync(target)) {
  rmSync(target);
  console.log('[remove-csr-fallback] silindi:', target);
} else {
  console.log('[remove-csr-fallback] dosya zaten yok, atlanıyor:', target);
}
