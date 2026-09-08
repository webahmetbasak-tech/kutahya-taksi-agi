/**
 * Dinamik `sitemap.xml` ve ortam-duyarlı `robots.txt` üretimi (§35, §36, §37).
 *
 * BİLEREK Angular route/component DEĞİL: bu saf metin/XML üretimidir, render
 * gerektirmez. `server.ts` içinde Angular'dan ÖNCE, düz bir Express route
 * olarak sunulur. Saf fonksiyonlar burada tutulur ki DOM/Angular olmadan
 * test edilebilsinler (bkz. `sitemap.spec.ts`).
 */
import { absoluteUrl, fetchRows, type PostgrestFetchConfig } from './postgrest-fetch';

export interface SitemapUrl {
  loc: string;
  /** `YYYY-MM-DD` biçiminde, yalnızca gerçek bir güncelleme tarihi varsa. */
  lastmod?: string;
}

export type SitemapConfig = PostgrestFetchConfig;

/**
 * Veriden bağımsız, her zaman var olan sayfalar. `/isletme-ekle`, `/panel`
 * BİLEREK YOK — biri işlevsiz bir form (henüz), diğeri kimlik doğrulama
 * arkasında; ikisi de sitemap'te olmayı hak eden "keşfedilmesi gereken"
 * sayfalar değil.
 */
const STATIC_PATHS = ['/', '/taksi', '/bolge', '/hizmet', '/hakkinda', '/gizlilik'] as const;

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
 * AI crawler politikası (§35, Faz 5'te birincil kaynaklardan doğrulandı — bkz.
 * PROJECT_PLAN.md Faz 5 notu). İki kategori:
 *
 * ARAMA/ERİŞİM BOTLARI — gerçek zamanlı arama/kullanıcı sorgusu, davranışımız
 * doğrudan "bulunabilirlik" hedefiyle örtüşür:
 *   - OAI-SearchBot, ChatGPT-User (OpenAI)
 *   - Claude-SearchBot, Claude-User (Anthropic)
 *   - PerplexityBot, Perplexity-User (Perplexity — User varyantı robots.txt'i
 *     zaten dikkate almadığını kendi dokümantasyonunda belirtiyor, yine de
 *     niyetimizi açıkça belirtmek için satır ekleniyor)
 *
 * EĞİTİM/MODEL BOTLARI — bir temel modelin eğitim külliyatına dahil olma;
 * bulunabilirlikle DOĞRUDAN ilgili değil (Google kendi dokümantasyonunda
 * Google-Extended'in Arama sıralamasını ETKİLEMEDİĞİNİ açıkça belirtiyor):
 *   - GPTBot (OpenAI), ClaudeBot (Anthropic), Google-Extended (Google/Gemini)
 *
 * KARAR: ikisi de **allow** — hedef görünürlük (§38) ve projenin "kapatmak
 * için özel bir nedenimiz yok" duruşu. Hiçbiri sıralama/görünürlük GARANTİSİ
 * anlamına gelmez (§73, §77).
 */
const AI_CRAWLER_USER_AGENTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'Google-Extended',
  'PerplexityBot',
  'Perplexity-User',
] as const;

/**
 * Production DIŞI ortamlar (preview/development) HER ZAMAN tamamen kapalıdır
 * — bu, `app.ts`'teki `noindex` meta etiketinin robots.txt seviyesindeki
 * eşleniğidir; aynı güvenlik ağı iki katmanda da var.
 */
export function buildRobotsTxt(options: { production: boolean; siteUrl: string }): string {
  if (!options.production) {
    return 'User-agent: *\nDisallow: /\n';
  }

  const aiBlocks = AI_CRAWLER_USER_AGENTS.map((ua) => `User-agent: ${ua}\nAllow: /`).join('\n\n');

  return `User-agent: *\nAllow: /\n\n${aiBlocks}\n\nSitemap: ${options.siteUrl}/sitemap.xml\n`;
}

interface SlugRow {
  slug: string;
  updated_at?: string;
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
    fetchRows<SlugRow>(config, 'businesses?select=slug,updated_at&status=eq.active', fetchFn),
    fetchRows<SlugRow>(config, 'locations?select=slug&type=eq.district', fetchFn),
    fetchRows<SlugRow>(
      config,
      'locations?select=slug&type=in.(landmark,airport,bus_station,university,hospital)',
      fetchFn,
    ),
    fetchRows<SlugRow>(config, 'services?select=slug&is_active=eq.true', fetchFn),
    fetchRows<SlugRow>(config, 'landing_page_stats?select=slug&is_indexable=eq.true', fetchFn),
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
