/**
 * `sitemap.ts` ve `llms-txt.ts` arasında paylaşılan, ince bir PostgREST okuma
 * yardımcısı.
 *
 * VERİ ERİŞİMİ: anon anahtarla gidilir, service_role KULLANILMAZ — bu iki
 * üretici de yalnızca RLS'in zaten anon'a gösterdiği veriyi listeler
 * (ARCHITECTURE.md §4, §14).
 */

export interface PostgrestFetchConfig {
  siteUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function absoluteUrl(siteUrl: string, path: string): string {
  return `${siteUrl}${path === '/' ? '' : path}`;
}

/**
 * `path` PostgREST sorgu dizesini (select/filter) zaten içerir, ör.
 * `'businesses?select=slug,updated_at&status=eq.active'`.
 */
export async function fetchRows<T>(
  config: PostgrestFetchConfig,
  path: string,
  fetchFn: typeof fetch,
): Promise<T[]> {
  const res = await fetchFn(`${config.supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${config.supabaseAnonKey}`,
    },
  });

  if (!res.ok) {
    throw new Error(`PostgREST veri isteği başarısız: ${path} -> HTTP ${res.status}`);
  }

  return (await res.json()) as T[];
}
