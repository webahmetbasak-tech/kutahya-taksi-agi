/**
 * Yapılandırılmış veri (JSON-LD) üreticileri — saf fonksiyonlar, DOM'a
 * dokunmazlar (bkz. `schema.service.ts`). Bu ayrım testlerin DOM olmadan
 * çalışmasını sağlar.
 *
 * ALTIN KURAL (§33, §63): HTML'de görünmeyen hiçbir bilgi buraya yazılmaz.
 * Her builder yalnızca kendisine verilen alanları kullanır; eksik alan
 * atlanır, ASLA varsayılan/uydurma değerle doldurulmaz.
 */

const SITE_NAME = 'Kütahya Taksi Ağı';
const CONTEXT = 'https://schema.org';

export interface BreadcrumbItem {
  name: string;
  /** Son öğe (mevcut sayfa) genellikle URL taşımaz. */
  url?: string;
}

export function buildBreadcrumbList(items: readonly BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.url ? { item: item.url } : {}),
    })),
  };
}

export interface ListItemInput {
  name: string;
  url: string;
}

/** Liste sayfaları için (§34) — her öğe kendi canonical URL'sine işaret eder. */
export function buildItemList(items: readonly ListItemInput[]): Record<string, unknown> {
  return {
    '@context': CONTEXT,
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

export function buildOrganization(siteUrl: string): Record<string, unknown> {
  return {
    '@context': CONTEXT,
    '@type': 'Organization',
    name: SITE_NAME,
    url: siteUrl,
  };
}

export function buildWebSite(siteUrl: string): Record<string, unknown> {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    name: SITE_NAME,
    url: siteUrl,
    inLanguage: 'tr-TR',
  };
}

/** `business_hours.day_of_week`: 0=Pazar … 6=Cumartesi (JS `Date.getDay()` ile aynı). */
const SCHEMA_DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export interface BusinessHoursInput {
  day_of_week: number;
  opens_at: string | null;
  closes_at: string | null;
  is_24h: boolean;
  is_closed: boolean;
}

function buildOpeningHours(hours: readonly BusinessHoursInput[]): Record<string, unknown>[] {
  return hours
    .filter((h) => !h.is_closed)
    .map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${SCHEMA_DAY_NAMES[h.day_of_week]}`,
      opens: h.is_24h ? '00:00' : trimSeconds(h.opens_at),
      closes: h.is_24h ? '23:59' : trimSeconds(h.closes_at),
    }));
}

function trimSeconds(time: string | null): string {
  // PostgREST `time` kolonunu "HH:MM:SS" döner; schema.org "HH:MM" bekler.
  return (time ?? '00:00').slice(0, 5);
}

export interface BusinessSchemaInput {
  name: string;
  /** Bu işletmenin kendi canonical detay URL'si. */
  url: string;
  description?: string | null;
  /** E.164. Doluysa yazılır — uydurma numara asla üretilmez (§20). */
  telephone?: string | null;
  address?: string | null;
  city: string;
  district?: string | null;
  neighborhood?: string | null;
  hours?: readonly BusinessHoursInput[];
}

/**
 * İşletme detay sayfası için yapılandırılmış veri.
 *
 * `aggregateRating` BİLEREK YAZILMAZ — V1'de gerçek değerlendirme sistemi yok
 * (§17). `openingHoursSpecification` yalnızca gerçekten doğrulanmış
 * `business_hours` kaydı varsa eklenir (§75 — tahmini saat uydurulmaz).
 */
export function buildLocalBusiness(input: BusinessSchemaInput): Record<string, unknown> {
  const areaServed = [input.neighborhood, input.district].filter(Boolean).join(', ') || input.city;

  const schema: Record<string, unknown> = {
    '@context': CONTEXT,
    '@type': ['LocalBusiness', 'TaxiService'],
    name: input.name,
    url: input.url,
    areaServed,
  };

  if (input.description) {
    schema['description'] = input.description;
  }

  if (input.telephone) {
    schema['telephone'] = input.telephone;
  }

  if (input.address) {
    schema['address'] = {
      '@type': 'PostalAddress',
      streetAddress: input.address,
      addressLocality: input.city,
      addressCountry: 'TR',
    };
  }

  if (input.hours && input.hours.length > 0) {
    const openingHours = buildOpeningHours(input.hours);
    if (openingHours.length > 0) {
      schema['openingHoursSpecification'] = openingHours;
    }
  }

  return schema;
}
