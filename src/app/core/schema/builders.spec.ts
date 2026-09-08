import {
  buildBreadcrumbList,
  buildItemList,
  buildLocalBusiness,
  buildOrganization,
  buildWebSite,
} from './builders';

describe('buildBreadcrumbList', () => {
  it('her öğeye position atar, son öğeye url eklemez', () => {
    const result = buildBreadcrumbList([
      { name: 'Taksiler', url: 'https://example.test/taksi' },
      { name: 'Zümrüt Taksi' },
    ]) as { '@type': string; itemListElement: { position: number; item?: string }[] };

    expect(result['@type']).toBe('BreadcrumbList');
    expect(result.itemListElement[0]?.position).toBe(1);
    expect(result.itemListElement[0]?.item).toBe('https://example.test/taksi');
    expect(result.itemListElement[1]?.item).toBeUndefined();
  });
});

describe('buildItemList', () => {
  it('her öğe kendi canonical URLsini taşır (§34)', () => {
    const result = buildItemList([
      { name: 'Zümrüt Taksi', url: 'https://example.test/taksi/zumrut-taksi' },
    ]) as { itemListElement: { url: string }[] };

    expect(result.itemListElement[0]?.url).toBe('https://example.test/taksi/zumrut-taksi');
  });
});

describe('buildOrganization / buildWebSite', () => {
  it('site URLsini kullanır', () => {
    expect(buildOrganization('https://example.test')['url']).toBe('https://example.test');
    expect(buildWebSite('https://example.test')['url']).toBe('https://example.test');
  });
});

describe('buildLocalBusiness', () => {
  const base = {
    name: 'Zümrüt Taksi',
    url: 'https://example.test/taksi/zumrut-taksi',
    city: 'Kütahya',
  };

  it('telefon yoksa telephone alanı HİÇ yazılmaz (§20 — uydurma numara yok)', () => {
    const result = buildLocalBusiness({ ...base, telephone: null });

    expect('telephone' in result).toBe(false);
  });

  it('telefon varsa telephone alanına yazılır', () => {
    const result = buildLocalBusiness({ ...base, telephone: '+905551112233' });

    expect(result['telephone']).toBe('+905551112233');
  });

  it('adres yoksa address alanı yazılmaz', () => {
    const result = buildLocalBusiness({ ...base, address: null });

    expect('address' in result).toBe(false);
  });

  it('adres varsa PostalAddress olarak yazılır', () => {
    const result = buildLocalBusiness({ ...base, address: 'Cumhuriyet Cad. No:1' }) as {
      address: { '@type': string; streetAddress: string; addressCountry: string };
    };

    expect(result.address['@type']).toBe('PostalAddress');
    expect(result.address.streetAddress).toBe('Cumhuriyet Cad. No:1');
    expect(result.address.addressCountry).toBe('TR');
  });

  it('aggregateRating ASLA yazılmaz (§17 — V1de review sistemi yok)', () => {
    const result = buildLocalBusiness(base);

    expect('aggregateRating' in result).toBe(false);
  });

  it('business_hours yoksa openingHoursSpecification yazılmaz', () => {
    const result = buildLocalBusiness(base);

    expect('openingHoursSpecification' in result).toBe(false);
  });

  it('is_closed=true olan günler openingHoursSpecificationa dahil edilmez', () => {
    const result = buildLocalBusiness({
      ...base,
      hours: [
        { day_of_week: 0, opens_at: null, closes_at: null, is_24h: false, is_closed: true },
        {
          day_of_week: 1,
          opens_at: '08:00:00',
          closes_at: '18:00:00',
          is_24h: false,
          is_closed: false,
        },
      ],
    }) as { openingHoursSpecification: { dayOfWeek: string; opens: string; closes: string }[] };

    expect(result.openingHoursSpecification).toHaveLength(1);
    expect(result.openingHoursSpecification[0]?.dayOfWeek).toContain('Monday');
    expect(result.openingHoursSpecification[0]?.opens).toBe('08:00');
  });

  it('is_24h=true ise 00:00–23:59 yazılır', () => {
    const result = buildLocalBusiness({
      ...base,
      hours: [{ day_of_week: 2, opens_at: null, closes_at: null, is_24h: true, is_closed: false }],
    }) as { openingHoursSpecification: { opens: string; closes: string }[] };

    expect(result.openingHoursSpecification[0]).toEqual(
      expect.objectContaining({ opens: '00:00', closes: '23:59' }),
    );
  });

  it('bölge alanı mahalle + ilçeden kurulur, ikisi de yoksa şehre düşer', () => {
    const withDistrict = buildLocalBusiness({ ...base, district: 'Merkez' });
    expect(withDistrict['areaServed']).toBe('Merkez');

    const withoutAny = buildLocalBusiness(base);
    expect(withoutAny['areaServed']).toBe('Kütahya');
  });
});
