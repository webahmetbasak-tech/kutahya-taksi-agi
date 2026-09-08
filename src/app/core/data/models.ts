/**
 * Uygulama modelleri.
 *
 * Tipler `database.types.ts`'ten TÜRETİLİR (elle yazılmaz), böylece şema
 * değiştiğinde derleme hatası alırız — sessiz uyuşmazlık olmaz.
 * `database.types.ts` şu komutla yeniden üretilir:
 *
 *   npm run db:types
 */
import type { Database } from './database.types';

type Tables = Database['public']['Tables'];
type Views = Database['public']['Views'];
type Functions = Database['public']['Functions'];

export type Category = Tables['categories']['Row'];
export type Service = Tables['services']['Row'];
export type LocationRow = Tables['locations']['Row'];
export type Business = Tables['businesses']['Row'];
export type BusinessMedia = Tables['business_media']['Row'];
export type BusinessHours = Tables['business_hours']['Row'];
export type AnalyticsDaily = Tables['analytics_daily']['Row'];
export type LandingPageStats = Views['landing_page_stats']['Row'];
export type NearbyBusinessRow = Functions['nearby_businesses']['Returns'][number];

/**
 * `landing_page_stats` şemadan üretilirken TÜM kolonları `| null` gelir —
 * Postgres view'ları için tip üreticisi NOT NULL bilgisini taşıyamıyor.
 * Gerçekte `lp.*` kolonları temel `landing_pages` tablosunun NOT NULL
 * garantisini (ve `group by lp.id` sayesinde satır başına tam 1 kaynak satırı
 * olmasını) miras alır — yani bu alanlar HİÇBİR ZAMAN gerçekten null gelmez.
 * `toLandingPageDetail()` bu daralmayı TEK yerde yapar; component'ler
 * `??`/opsiyonel zincirlemeyle doldurulmaz.
 */
export interface LandingPageDetail {
  id: string;
  slug: string;
  title: string;
  h1: string;
  intro: string | null;
  meta_description: string | null;
  location_id: string | null;
  service_id: string | null;
  business_count: number;
  is_indexable: boolean;
}

export function toLandingPageDetail(row: LandingPageStats): LandingPageDetail {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    h1: row.h1 as string,
    intro: row.intro,
    meta_description: row.meta_description,
    location_id: row.location_id,
    service_id: row.service_id,
    business_count: row.business_count ?? 0,
    is_indexable: row.is_indexable ?? false,
  };
}

/**
 * `resolve_missing_business_slug` RPC'sinin döndürdüğü sınıflandırma (§64).
 * Üretilen tip yalnızca `string | null` diyor (Postgres composite type'lar
 * enum bilgisini taşımıyor); olası değerleri SQL fonksiyonunu biz yazdığımız
 * için burada daraltıyoruz.
 */
export type SlugResolutionOutcome = 'redirect' | 'archived' | 'not_found';
export interface SlugResolution {
  outcome: SlugResolutionOutcome;
  new_slug: string | null;
}

export type BusinessStatus = Database['public']['Enums']['business_status'];
export type VerificationStatus = Database['public']['Enums']['verification_status'];
export type SourceType = Database['public']['Enums']['source_type'];
export type LocationType = Database['public']['Enums']['location_type'];
export type AnalyticsEventType = Database['public']['Enums']['analytics_event_type'];

/**
 * Liste ve detay sayfalarının ihtiyaç duyduğu alanlar.
 *
 * `select=*` bilerek kullanılmıyor: gereksiz kolon çekmek hem SSR yanıtını hem
 * TransferState yükünü büyütür, hem de ileride eklenen bir kolonun istemeden
 * public'e sızmasına yol açar.
 */
export const BUSINESS_CARD_FIELDS = [
  'id',
  'slug',
  'business_name',
  'phone_e164',
  'phone_display',
  'whatsapp_e164',
  'district',
  'neighborhood',
  'verification_status',
  'last_verified_at',
  'google_maps_url',
].join(',');

export const BUSINESS_DETAIL_FIELDS = [
  BUSINESS_CARD_FIELDS,
  'description',
  'address',
  'city',
  'latitude',
  'longitude',
  'website',
  'source_type',
  'updated_at',
].join(',');

/** Liste kartı için daraltılmış işletme tipi. */
export type BusinessCard = Pick<
  Business,
  | 'id'
  | 'slug'
  | 'business_name'
  | 'phone_e164'
  | 'phone_display'
  | 'whatsapp_e164'
  | 'district'
  | 'neighborhood'
  | 'verification_status'
  | 'last_verified_at'
  | 'google_maps_url'
>;

/** Detay sayfası için işletme tipi. */
export type BusinessDetail = BusinessCard &
  Pick<
    Business,
    | 'description'
    | 'address'
    | 'city'
    | 'latitude'
    | 'longitude'
    | 'website'
    | 'source_type'
    | 'updated_at'
  >;

/** Detay sayfasında gösterilen çalışma saati satırı. */
export type BusinessHoursRow = Pick<
  BusinessHours,
  'day_of_week' | 'opens_at' | 'closes_at' | 'is_24h' | 'is_closed'
>;

/** Panel istatistik satırı — RLS (`analytics_daily_select_own`) yalnızca sahibine/admin'e açar. */
export type AnalyticsDailyRow = Pick<AnalyticsDaily, 'day' | 'event_type' | 'event_count'>;
