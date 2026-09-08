import { buildLlmsTxt, fetchLlmsTxtData } from './llms-txt';

describe('buildLlmsTxt', () => {
  const emptyData = {
    siteUrl: 'https://example.test',
    businesses: [],
    locations: [],
    services: [],
  };

  it('site başlığını ve açıklamasını içerir', () => {
    const txt = buildLlmsTxt(emptyData);

    expect(txt).toContain('# Kütahya Taksi Ağı');
    expect(txt).toContain('> Kütahya');
  });

  it('görünürlük garantisi vermediğini AÇIKÇA belirtir (§38, §73)', () => {
    const txt = buildLlmsTxt(emptyData);

    expect(txt).toContain('görünürlük garantisi değildir');
  });

  it('ana sayfaların temiz linklerini içerir (§40)', () => {
    const txt = buildLlmsTxt(emptyData);

    expect(txt).toContain('[Kütahya Taksileri](https://example.test/taksi)');
    expect(txt).toContain('[Bölgeler](https://example.test/bolge)');
    expect(txt).toContain('[Hizmetler](https://example.test/hizmet)');
    expect(txt).toContain('[Hakkında](https://example.test/hakkinda)');
  });

  it('/panel ve /isletme-ekle HİÇ geçmez (DoD: yalnızca aktif/indexlenebilir URL)', () => {
    const txt = buildLlmsTxt(emptyData);

    expect(txt).not.toContain('/panel');
    expect(txt).not.toContain('isletme-ekle');
  });

  it('boş bölümlerde sahte içerik üretmez, dürüstçe "yok" yazar (§74, R1)', () => {
    const txt = buildLlmsTxt(emptyData);

    expect(txt).toContain('(henüz yayınlanmış içerik yok)');
  });

  it('gerçek işletmeleri bölgesiyle birlikte listeler', () => {
    const txt = buildLlmsTxt({
      ...emptyData,
      businesses: [{ name: 'Zümrüt Taksi', slug: 'zumrut-taksi', district: 'Merkez' }],
    });

    expect(txt).toContain('[Zümrüt Taksi](https://example.test/taksi/zumrut-taksi) — Merkez');
  });

  it('bölge ve hizmetleri listeler', () => {
    const txt = buildLlmsTxt({
      ...emptyData,
      locations: [{ name: 'Kütahya Merkez', slug: 'merkez' }],
      services: [{ name: '7/24 Taksi', slug: '724-taksi' }],
    });

    expect(txt).toContain('[Kütahya Merkez](https://example.test/bolge/merkez)');
    expect(txt).toContain('[7/24 Taksi](https://example.test/hizmet/724-taksi)');
  });
});

describe('fetchLlmsTxtData', () => {
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

  it('işletme adı ve bölgesini doğru alanlardan eşler', async () => {
    const fetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/businesses')) {
        return Promise.resolve(
          jsonResponse([
            { slug: 'zumrut-taksi', business_name: 'Zümrüt Taksi', district: 'Merkez' },
          ]),
        );
      }
      return Promise.resolve(jsonResponse([]));
    });

    const data = await fetchLlmsTxtData(config, fetchFn);

    expect(data.businesses).toEqual([
      { name: 'Zümrüt Taksi', slug: 'zumrut-taksi', district: 'Merkez' },
    ]);
  });

  it('anon anahtarı her istekte gönderir', async () => {
    const fetchFn = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse([])));

    await fetchLlmsTxtData(config, fetchFn);

    const [, options] = fetchFn.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['apikey']).toBe('anon-test-key');
  });

  it('bir istek başarısız olursa hata fırlatır', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('hata', { status: 500 }));

    await expect(fetchLlmsTxtData(config, fetchFn)).rejects.toThrow();
  });
});
