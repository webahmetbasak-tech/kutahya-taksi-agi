/**
 * `/llms.txt` üretimi (§40).
 *
 * llms.txt, AI ajanlarının bir sitenin yapısını hızlıca anlaması için önerilen
 * (ama resmî bir standart OLMAYAN) bir kongandır. `sitemap.xml` ile aynı
 * ilkeler geçerlidir: Angular route değil, `server.ts`'te düz bir Express
 * route'u; yalnızca RLS'in anon'a zaten gösterdiği veriyi listeler;
 * BU DOSYA HİÇBİR AI SİSTEMİNDE GÖRÜNÜRLÜK GARANTİSİ VERMEZ (§38, §40, §73).
 *
 * DoD (PROJECT_PLAN.md Faz 5): yalnızca aktif/indexlenebilir URL'ler
 * listelenir — `/panel`, `/isletme-ekle`, pending/archived işletmeler YOK.
 */
import { absoluteUrl, fetchRows, type PostgrestFetchConfig } from './postgrest-fetch';

export type LlmsTxtConfig = PostgrestFetchConfig;

interface NamedRow {
  slug: string;
  name?: string;
  business_name?: string;
  district?: string | null;
}

export interface LlmsTxtData {
  siteUrl: string;
  businesses: readonly { name: string; slug: string; district: string | null }[];
  locations: readonly { name: string; slug: string }[];
  services: readonly { name: string; slug: string }[];
}

function section(title: string, lines: readonly string[]): string {
  const body = lines.length > 0 ? lines.join('\n') : '(henüz yayınlanmış içerik yok)';
  return `## ${title}\n\n${body}\n`;
}

/**
 * Saf metin üretimi — DOM/HTTP'siz test edilebilir (bkz. `llms-txt.spec.ts`).
 *
 * Boş bölümler SESSİZCE atlanmaz, "henüz yayınlanmış içerik yok" yazar — bu,
 * projenin R1 gerçeğini (henüz doğrulanmış işletme yok) gizlemek yerine dürüstçe
 * yansıtır; sahte/dolgu içerik üretmez (§74).
 */
export function buildLlmsTxt(data: LlmsTxtData): string {
  const parts: string[] = [];

  parts.push('# Kütahya Taksi Ağı');
  parts.push('');
  parts.push(
    "> Kütahya'daki taksi işletmelerini tek yerde toplayan yerel işletme rehberi. " +
      'Kullanıcılar işletmeleri arayıp doğrudan telefon, WhatsApp veya yol tarifiyle ulaşır. ' +
      'Bu dosya bir görünürlük garantisi değildir; yalnızca sitenin yapısını açıklar.',
  );
  parts.push('');

  parts.push(
    section('Ana Sayfalar', [
      `- [Kütahya Taksileri](${absoluteUrl(data.siteUrl, '/taksi')}): Doğrulanmış taksi işletmelerinin tam listesi`,
      `- [Bölgeler](${absoluteUrl(data.siteUrl, '/bolge')}): Kütahya merkez ve ilçelerine göre taksi arama`,
      `- [Hizmetler](${absoluteUrl(data.siteUrl, '/hizmet')}): 7/24, havalimanı, şehirlerarası taksi hizmetleri`,
      `- [Hakkında](${absoluteUrl(data.siteUrl, '/hakkinda')}): Platformun nasıl çalıştığı ve bilgi doğruluğu ilkeleri`,
    ]),
  );
  parts.push('');

  parts.push(
    section(
      'Bölgeler',
      data.locations.map((l) => `- [${l.name}](${absoluteUrl(data.siteUrl, `/bolge/${l.slug}`)})`),
    ),
  );
  parts.push('');

  parts.push(
    section(
      'Hizmetler',
      data.services.map((s) => `- [${s.name}](${absoluteUrl(data.siteUrl, `/hizmet/${s.slug}`)})`),
    ),
  );
  parts.push('');

  parts.push(
    section(
      'İşletme Profilleri',
      data.businesses.map((b) => {
        const suffix = b.district ? ` — ${b.district}` : '';
        return `- [${b.name}](${absoluteUrl(data.siteUrl, `/taksi/${b.slug}`)})${suffix}`;
      }),
    ),
  );

  return parts.join('\n') + '\n';
}

/**
 * Yalnızca RLS'in anon'a zaten gösterdiği veriyi okur (ARCHITECTURE.md §4).
 * `businesses` için `status=active` filtresi RLS tarafından uygulanır; burada
 * TEKRAR yazılmaz — tek doğruluk kaynağı veritabanında kalır.
 */
export async function fetchLlmsTxtData(
  config: LlmsTxtConfig,
  fetchFn: typeof fetch = fetch,
): Promise<LlmsTxtData> {
  const [businesses, districts, landmarks, services] = await Promise.all([
    fetchRows<NamedRow>(
      config,
      'businesses?select=slug,business_name,district&status=eq.active&order=business_name.asc',
      fetchFn,
    ),
    fetchRows<NamedRow>(
      config,
      'locations?select=slug,name&type=eq.district&is_active=eq.true&order=name.asc',
      fetchFn,
    ),
    fetchRows<NamedRow>(
      config,
      'locations?select=slug,name&type=in.(landmark,airport,bus_station,university,hospital)&is_active=eq.true&order=name.asc',
      fetchFn,
    ),
    fetchRows<NamedRow>(
      config,
      'services?select=slug,name&is_active=eq.true&order=sort_order.asc',
      fetchFn,
    ),
  ]);

  return {
    siteUrl: config.siteUrl,
    businesses: businesses.map((b) => ({
      name: b.business_name ?? b.slug,
      slug: b.slug,
      district: b.district ?? null,
    })),
    locations: [...districts, ...landmarks].map((l) => ({ name: l.name ?? l.slug, slug: l.slug })),
    services: services.map((s) => ({ name: s.name ?? s.slug, slug: s.slug })),
  };
}
