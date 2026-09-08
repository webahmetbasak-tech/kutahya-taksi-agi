import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { APP_CONFIG } from '@core/config/app-config';

/**
 * Supabase'in PostgREST arayüzüne Angular `HttpClient` üzerinden erişim.
 *
 * NEDEN `supabase-js` DEĞİL? (ARCHITECTURE.md §4)
 *
 * 1. TransferState. `provideClientHydration(withHttpTransferCacheOptions(...))`
 *    yalnızca `HttpClient` trafiğini yakalar. `supabase-js` kendi `fetch`'ini
 *    kullandığı için sunucuda çekilen veri hydration sırasında İKİNCİ KEZ
 *    çekilirdi — SEO-first bir sitede kabul edilemez bir israf.
 * 2. Bundle. gotrue + realtime + storage public kritik yola girmez.
 * 3. Tek noktadan interceptor/cache/hata yönetimi.
 *
 * `supabase-js` yalnızca lazy `auth`/`dashboard`/`admin` chunk'larında, Auth ve
 * Storage için kullanılacak (Faz 7+).
 *
 * GÜVENLİK: anon anahtar burada açıkça gönderilir ve client bundle'a girer.
 * Bu normaldir — koruma Row Level Security'dedir (§54), anahtarın gizliliğinde
 * değil. Bu istemci yalnızca OKUMA yapar.
 */
@Injectable({ providedIn: 'root' })
export class PostgrestClient {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);

  private get baseUrl(): string {
    return `${this.config.supabaseUrl}/rest/v1`;
  }

  private get headers(): Record<string, string> {
    return {
      apikey: this.config.supabaseAnonKey,
      Authorization: `Bearer ${this.config.supabaseAnonKey}`,
    };
  }

  /**
   * Bir tablodan/görünümden satır listesi okur.
   *
   * `query` PostgREST filtre sözdizimini kullanır:
   *   { select: 'id,slug', status: 'eq.active', order: 'created_at.desc' }
   */
  list<T>(resource: string, query: PostgrestQuery = {}): Observable<T[]> {
    return this.http.get<T[]>(`${this.baseUrl}/${resource}`, {
      headers: this.headers,
      params: toParams(query),
    });
  }

  /**
   * Tek satır okur; eşleşme yoksa `null` döner.
   *
   * PostgREST'in `.single()` davranışını taklit etmek yerine dizi alıp ilkini
   * almayı tercih ediyoruz: `Accept: application/vnd.pgrst.object+json` eşleşme
   * bulamadığında 406 fırlatır ve "bulunamadı" durumunu hata gibi gösterirdi.
   * Bulunamamak bu uygulamada normal bir sonuçtur (silinmiş işletme → 404 sayfası).
   */
  single<T>(resource: string, query: PostgrestQuery = {}): Observable<T | null> {
    return this.list<T>(resource, { ...query, limit: '1' }).pipe(map((rows) => rows[0] ?? null));
  }

  /** Yazma yalnızca analytics olayları için; başka hiçbir yazma yolu yok. */
  insert<T>(resource: string, payload: T | T[]): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${resource}`, payload, {
      headers: { ...this.headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    });
  }
}

/** PostgREST sorgu parametreleri: `select`, `order`, `limit` ve filtreler. */
export type PostgrestQuery = Record<string, string | number | undefined>;

function toParams(query: PostgrestQuery): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}
