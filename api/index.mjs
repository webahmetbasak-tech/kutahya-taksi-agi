/**
 * Vercel serverless function adapter'ı.
 *
 * NEDEN GEREKLİ?
 * Vercel'in Angular için zero-config SSR desteği yoktur. Adapter olmadan Vercel
 * `dist/.../browser/index.html`'i görüp statik servis eder, `server.mjs` hiç
 * çağrılmaz. Sonuç sessizdir: site çalışır ama her sayfa boş bir kabuk olarak
 * gelir — yani SSR "açık" görünürken SEO tamamen ölür.
 *
 * Bu dosya Angular'ın ürettiği `reqHandler`'ı Vercel'in Node runtime'ına bağlar.
 * Yönlendirme kuralları `vercel.json` içindedir.
 *
 * Doğrulama (Faz 1 DoD):
 *   curl -s https://<deployment>/taksi/deneme-slug | grep deneme-slug
 * Çıktı boşsa SSR çalışmıyordur.
 */
export { reqHandler as default } from '../dist/kutahya-taksi-agi/server/server.mjs';
