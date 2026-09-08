/**
 * Build zamanında üretilen ortam yapılandırmasının şekli.
 *
 * Buradaki hiçbir alan gizli değildir. `supabaseAnonKey` client bundle'a girer ve
 * bu normaldir — güvenlik Supabase Row Level Security ile sağlanır, anahtarın
 * gizliliğiyle değil. `service_role` anahtarı bu tipe ASLA eklenmez.
 */
export interface AppEnvironment {
  /** 'development' | 'preview' | 'production' */
  readonly environment: string;
  readonly production: boolean;
  /** Canonical/sitemap/OG için mutlak taban adres, sonunda "/" yok. */
  readonly siteUrl: string;
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
}
