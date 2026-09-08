import { buildRobotsTxt, buildSitemapXml, fetchSitemapUrls } from './sitemap';

describe('buildSitemapXml', () => {
  it('geçerli bir XML sitemap üretir', () => {
    const xml = buildSitemapXml([{ loc: 'https://example.test/taksi' }]);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>https://example.test/taksi</loc>');
  });

  it('lastmod yalnızca verilmişse eklenir', () => {
    const withDate = buildSitemapXml([{ loc: 'https://example.test/a', lastmod: '2026-09-01' }]);
    const withoutDate = buildSitemapXml([{ loc: 'https://example.test/b' }]);

    expect(withDate).toContain('<lastmod>2026-09-01</lastmod>');
    expect(withoutDate).not.toContain('<lastmod>');
  });

  it('XML özel karakterlerini escape eder (ör. & işletme isminde)', () => {
    const xml = buildSitemapXml([{ loc: 'https://example.test/taksi/a&b' }]);

    expect(xml).toContain('a&amp;b');
    expect(xml).not.toContain('a&b<');
  });
});

describe('buildRobotsTxt', () => {
  it('production DIŞINDA HER ŞEYİ kapatır (preview/development sızıntısına karşı güvenlik ağı)', () => {
    const txt = buildRobotsTxt({ production: false, siteUrl: 'https://example.test' });

    expect(txt).toBe('User-agent: *\nDisallow: /\n');
  });

  it("production'da her şeye izin verir ve sitemap URLsini bildirir", () => {
    const txt = buildRobotsTxt({ production: true, siteUrl: 'https://example.test' });

    expect(txt).toContain('Allow: /');
    expect(txt).toContain('Sitemap: https://example.test/sitemap.xml');
    expect(txt).not.toContain('Disallow');
  });
});

describe('fetchSitemapUrls', () => {
  const config = {
    siteUrl: 'https://example.test',
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'anon-test-key',
  };

  function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('statik sayfaları her zaman içerir', async () => {
    const fetchFn = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse([])));

    const urls = await fetchSitemapUrls(config, fetchFn);

    expect(urls.map((u) => u.loc)).toEqual(
      expect.arrayContaining([
        'https://example.test',
        'https://example.test/taksi',
        'https://example.test/bolge',
        'https://example.test/hizmet',
        'https://example.test/hakkinda',
        'https://example.test/gizlilik',
      ]),
    );
  });

  it('anon anahtarı her istekte hem apikey hem Authorization olarak gönderir', async () => {
    const fetchFn = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse([])));

    await fetchSitemapUrls(config, fetchFn);

    const [, options] = fetchFn.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['apikey']).toBe('anon-test-key');
    expect(headers['Authorization']).toBe('Bearer anon-test-key');
  });

  it('aktif işletmeleri gerçek slug ve lastmod ile ekler', async () => {
    const fetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/businesses')) {
        return Promise.resolve(
          jsonResponse([{ slug: 'zumrut-taksi', updated_at: '2026-09-01T12:00:00Z' }]),
        );
      }
      return Promise.resolve(jsonResponse([]));
    });

    const urls = await fetchSitemapUrls(config, fetchFn);
    const business = urls.find((u) => u.loc.includes('zumrut-taksi'));

    expect(business?.loc).toBe('https://example.test/taksi/zumrut-taksi');
    expect(business?.lastmod).toBe('2026-09-01');
  });

  it("yalnızca is_indexable=true olan landing page'leri ekler (istek zaten filtreli)", async () => {
    const fetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.includes('landing_page_stats')) {
        // §31: view zaten is_indexable=true filtresini uyguluyor; burada
        // yalnızca isteğin doğru endpoint'e doğru filtreyle gittiğini doğruluyoruz.
        expect(url).toContain('is_indexable=eq.true');
        return Promise.resolve(jsonResponse([{ slug: 'kutahya-724-taksi' }]));
      }
      return Promise.resolve(jsonResponse([]));
    });

    const urls = await fetchSitemapUrls(config, fetchFn);

    expect(urls.some((u) => u.loc === 'https://example.test/kutahya-724-taksi')).toBe(true);
  });

  it('bir PostgREST isteği başarısız olursa hata fırlatır (sessizce boş sitemap üretmez)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('hata', { status: 500 }));

    await expect(fetchSitemapUrls(config, fetchFn)).rejects.toThrow();
  });
});
