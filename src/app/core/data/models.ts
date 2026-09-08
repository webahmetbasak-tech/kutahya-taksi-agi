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
export type LandingPageStats = Views['landing_page_stats']['Row'];
export type NearbyBusinessRow = Functions['nearby_businesses']['Returns'][number];

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
