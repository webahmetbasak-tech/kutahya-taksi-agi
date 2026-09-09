import { RenderMode, type ServerRoute } from '@angular/ssr';

/**
 * Route bazlı render modları (ARCHITECTURE.md §3).
 *
 * - `Server`   : içeriği veritabanından gelen, taze kalması gereken public sayfalar.
 *                Edge cache header'ı burada verilir; Vercel bunu CDN'de saklar, yani
 *                crawler ve kullanıcı çoğunlukla statik hızda cevap alır ama içerik
 *                en geç 5 dakikada tazelenir.
 * - `Prerender`: build zamanında sabitlenen, veriden bağımsız içerik sayfaları.
 * - `Client`   : SEO'ya konu olmayan, kimlik doğrulama arkasındaki ekranlar.
 *
 * DİKKAT: `s-maxage` yalnızca paylaşımlı cache (CDN) içindir; `max-age=0` ile
 * tarayıcının bayat içerik göstermesi engellenir.
 */
const PUBLIC_CACHE = 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';

/** Uzun ömürlü, nadiren değişen sayfalar için. */
const STATIC_CACHE = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Server,
    headers: { 'Cache-Control': PUBLIC_CACHE },
  },
  {
    path: 'taksi',
    renderMode: RenderMode.Server,
    headers: { 'Cache-Control': PUBLIC_CACHE },
  },
  {
    // Slug'lar veritabanından gelir; build zamanında bilinemez, bu yüzden istek
    // anında render edilir.
    path: 'taksi/:slug',
    renderMode: RenderMode.Server,
    headers: { 'Cache-Control': PUBLIC_CACHE },
  },
  {
    // Oturuma bağlı, kişiye özel; sunucuda render edilmez (bkz. 'panel').
    path: 'taksi/:slug/sahiplen',
    renderMode: RenderMode.Client,
    headers: { 'Cache-Control': 'private, no-store' },
  },
  {
    // Faz 9c, KVKK (§56): oturum GEREKTİRMEZ ama bir "profil" değil bir form —
    // SEO'ya konu değil, sunucuda render edilmez.
    path: 'taksi/:slug/kaldirma-talebi',
    renderMode: RenderMode.Client,
    headers: { 'Cache-Control': 'private, no-store' },
  },
  {
    path: 'bolge',
    renderMode: RenderMode.Server,
    headers: { 'Cache-Control': PUBLIC_CACHE },
  },
  {
    path: 'bolge/:slug',
    renderMode: RenderMode.Server,
    headers: { 'Cache-Control': PUBLIC_CACHE },
  },
  {
    path: 'hizmet',
    renderMode: RenderMode.Server,
    headers: { 'Cache-Control': PUBLIC_CACHE },
  },
  {
    path: 'hizmet/:slug',
    renderMode: RenderMode.Server,
    headers: { 'Cache-Control': PUBLIC_CACHE },
  },
  {
    // Faz 8: oturum gerektiren gerçek bir form (Faz 1'deki statik "yakında"
    // iskeletinin aksine) — 'sahiplen'/'panel' ile aynı nedenle sunucuda
    // render edilmez/cache'lenmez.
    path: 'isletme-ekle',
    renderMode: RenderMode.Client,
    headers: { 'Cache-Control': 'private, no-store' },
  },
  {
    path: 'hakkinda',
    renderMode: RenderMode.Prerender,
    headers: { 'Cache-Control': STATIC_CACHE },
  },
  {
    path: 'gizlilik',
    renderMode: RenderMode.Prerender,
    headers: { 'Cache-Control': STATIC_CACHE },
  },
  {
    // Panel kimlik doğrulama arkasında; sunucuda render edilmez, cache'lenmez.
    path: 'panel',
    renderMode: RenderMode.Client,
    headers: { 'Cache-Control': 'private, no-store' },
  },
  {
    // Oturum durumu istemciye özgüdür; sunucuda render edilmez.
    path: 'giris',
    renderMode: RenderMode.Client,
    headers: { 'Cache-Control': 'private, no-store' },
  },
  {
    // Faz 9: admin panelin TÜMÜ (bkz. `lazyAdminGuard`) — kimlik doğrulama +
    // rol kontrolü arkasında, SEO'ya konu değil. `admin/**` çocuk route'ların
    // hepsini kapsar; ayrıca çıplak `admin`'i de garantiye almak için ikinci
    // bir giriş.
    path: 'admin',
    renderMode: RenderMode.Client,
    headers: { 'Cache-Control': 'private, no-store' },
  },
  {
    path: 'admin/**',
    renderMode: RenderMode.Client,
    headers: { 'Cache-Control': 'private, no-store' },
  },
  {
    // landing_pages tablosundan gelen SEO sayfaları (ör. /kutahya-724-taksi).
    // Durum kodu (200/404) component'in kendi RESPONSE_INIT mantığından gelir.
    path: ':slug',
    renderMode: RenderMode.Server,
    headers: { 'Cache-Control': PUBLIC_CACHE },
  },
  {
    // Bilinmeyen URL'ler gerçek 404 döner — "soft 404" oluşmaz (§64).
    path: '**',
    renderMode: RenderMode.Server,
    status: 404,
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' },
  },
];
