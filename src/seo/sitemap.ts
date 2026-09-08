/**
 * Dinamik `sitemap.xml` ve ortam-duyarlı `robots.txt` üretimi (§35, §36, §37).
 *
 * BİLEREK Angular route/component DEĞİL: bu saf metin/XML üretimidir, render
 * gerektirmez. `server.ts` içinde Angular'dan ÖNCE, düz bir Express route
 * olarak sunulur. Saf fonksiyonlar burada tutulur ki DOM/Angular olmadan
 * test edilebilsinler (bkz. `sitemap.spec.ts`).
 *
 * VERİ ERİŞİMİ: PostgREST'e anon anahtarla gidilir — service_role KULLANILMAZ.
 * Sitemap yalnızca zaten PUBLIC olan veriyi listeler (RLS'in anon'a gösterdiği
 * her şey); service_role gerekmediği için burada da yok (ARCHITECTURE.md §14).
 */

export interface SitemapUrl {
  loc: string;
  /** `YYYY-MM-DD` biçiminde, yalnızca gerçek bir güncelleme tarihi varsa. */
  lastmod?: string;
}

export interface SitemapConfig {
  siteUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

/**
 * Veriden bağımsız, her zaman var olan sayfalar. `/isletme-ekle`, `/panel`
 * BİLEREK YOK — biri işlevsiz bir form (henüz), diğeri kimlik doğrulama
 * arkasında; ikisi de sitemap'te olmayı hak eden "keşfedilmesi gereken"
 * sayfalar değil.
 */
const STATIC_PATHS = ['/', '/taksi', '/bolge', '/hizmet', '/hakkinda', '/gizlilik'] as const;

function absoluteUrl(siteUrl: string, path: string): string {
  return `${siteUrl}${path === '/' ? '' : path}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildSitemapXml(urls: readonly SitemapUrl[]): string {
  const items = urls
    .map((u) => {
      const lastmod = u.lastmod ? `\n    <lastmod>${escapeXml(u.lastmod)}</lastmod>` : '';
      return `  <url>\n    <loc>${escapeXml(u.loc)}</loc>${lastmod}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

/**
 * §35: hiçbir crawler varsayılan olarak körlemesine engellenmez. Bot bazlı
 * ince ayar (arama/erişim botlarını ayırmak vb.) Faz 5'te güncel resmî
 * dokümantasyonla doğrulanarak eklenecek.
 *
 * Production DIŞI ortamlar (preview/development) HER ZAMAN tamamen kapalıdır
 * — bu, `app.ts`'teki `noindex` meta etiketinin robots.txt seviyesindeki
 * eşleniğidir; aynı güvenlik ağı iki katmanda da var.
 */
export function buildRobotsTxt(options: { production: boolean; siteUrl: string }): string {
  if (!options.production) {
    return 'User-agent: *\nDisallow: /\n';
  }
  return `User-agent: *\nAllow: /\n\nSitemap: ${options.siteUrl}/sitemap.xml\n`;
}

interface PostgrestRow {
  slug: string;
  updated_at?: string;
}

async function fetchRows(
  config: SitemapConfig,
  path: string,
  fetchFn: typeof fetch,
): Promise<PostgrestRow[]> {
  const res = await fetchFn(`${config.supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${config.supabaseAnonKey}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Sitemap veri isteği başarısız: ${path} -> HTTP ${res.status}`);
  }

  return (await res.json()) as PostgrestRow[];
}

/**
 * Tüm indexlenebilir URL'leri toplar. Yalnızca RLS'in anon'a zaten gösterdiği
 * veriyi okur — `businesses` için `status=active` filtresi burada AYRICA
 * yazılmıyor çünkü RLS onu her koşulda uyguluyor (ARCHITECTURE.md §4 ilkesi).
 *
 * `/bolge/:slug` ve `/hizmet/:slug` iş sayısından BAĞIMSIZ dahil edilir —
 * bunlar `landing_pages` (§31) gibi üretilmiş SEO sayfaları değil, Kütahya'nın
 * gerçek coğrafyasını/hizmet taksonomisini anlatan kalıcı referans sayfaları.
 * `landing_pages` ise tam tersine YALNIZCA `is_indexable=true` iken girer —
 * o eşik `landing_page_stats` view'ında zaten hesaplı (§31 thin content kapısı).
 */
export async function fetchSitemapUrls(
  config: SitemapConfig,
  fetchFn: typeof fetch = fetch,
): Promise<SitemapUrl[]> {
  const urls: SitemapUrl[] = STATIC_PATHS.map((path) => ({
    loc: absoluteUrl(config.siteUrl, path),
  }));

  const [businesses, districts, landmarks, services, landingPages] = await Promise.all([
    fetchRows(config, 'businesses?select=slug,updated_at&status=eq.active', fetchFn),
    fetchRows(config, 'locations?select=slug&type=eq.district', fetchFn),
    fetchRows(
      config,
      'locations?select=slug&type=in.(landmark,airport,bus_station,university,hospital)',
      fetchFn,
    ),
    fetchRows(config, 'services?select=slug&is_active=eq.true', fetchFn),
    fetchRows(config, 'landing_page_stats?select=slug&is_indexable=eq.true', fetchFn),
  ]);

  for (const b of businesses) {
    const lastmod = b.updated_at?.slice(0, 10);
    urls.push({
      loc: absoluteUrl(config.siteUrl, `/taksi/${b.slug}`),
      ...(lastmod ? { lastmod } : {}),
    });
  }
  for (const l of [...districts, ...landmarks]) {
    urls.push({ loc: absoluteUrl(config.siteUrl, `/bolge/${l.slug}`) });
  }
  for (const s of services) {
    urls.push({ loc: absoluteUrl(config.siteUrl, `/hizmet/${s.slug}`) });
  }
  for (const lp of landingPages) {
    urls.push({ loc: absoluteUrl(config.siteUrl, `/${lp.slug}`) });
  }

  return urls;
}
