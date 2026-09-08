import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, makeStateKey, PLATFORM_ID, TransferState } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { map, of, tap, type Observable } from 'rxjs';
import { APP_CONFIG } from '@core/config/app-config';

/**
 * Supabase'in PostgREST arayüzüne Angular `HttpClient` üzerinden erişim.
 *
 * NEDEN `supabase-js` DEĞİL? (ARCHITECTURE.md §4)
 *
 * 1. TransferState. Sunucuda çekilen veri hydration sırasında tarayıcıda
 *    İKİNCİ KEZ çekilmemeli — SEO-first bir sitede bu kabul edilemez bir israf.
 * 2. Bundle. gotrue + realtime + storage public kritik yola girmez.
 * 3. Tek noktadan interceptor/cache/hata yönetimi.
 *
 * `supabase-js` yalnızca lazy `auth`/`dashboard`/`admin` chunk'larında, Auth ve
 * Storage için kullanılacak (Faz 7+).
 *
 * GÜVENLİK: anon anahtar burada açıkça gönderilir ve client bundle'a girer.
 * Bu normaldir — koruma Row Level Security'dedir (§54), anahtarın gizliliğinde
 * değil. Bu istemci yalnızca OKUMA yapar (RPC'ler de `stable`/`SECURITY INVOKER`).
 *
 * TRANSFERSTATE ELLE UYGULANIYOR (Faz 3 bulgusu — ARCHITECTURE.md §4):
 * Angular'ın yerleşik `withHttpTransferCacheOptions` özelliği bu projede
 * ÇALIŞMIYOR. Kök neden doğrulandı: `@angular/platform-server` 22.1.5'te
 * `globalThis.ngServerMode`'u true yapan kod bilerek/yanlışlıkla ölü kod
 * olarak derleniyor (`if (false) { globalThis.ngServerMode = true }`),
 * ve `withHttpTransferCacheOptions`'ın sunucu tarafı yazma dalı tam olarak
 * bu bayrağın arkasında. Sonuç: SSR'da hiçbir HTTP yanıtı TransferState'e
 * yazılmıyor, tarayıcı her isteği hydration'da tekrarlıyor — mimarinin
 * önlemeye çalıştığı israf. Bu, projeye özgü bir yanlış yapılandırma değil;
 * `@angular/ssr`'ın `provideServerRendering`'i de aynı ölü koda düşüyor,
 * yani bu satırları kullanan her SSR uygulamasını etkiler.
 *
 * Çözüm: aynı `TransferState` API'sini (Angular'ın kendi altyapısı) BURADA,
 * elle kullanıyoruz — genel bir HttpClient interceptor'ı değil, yalnızca bu
 * istemcinin okuma metotları için. `insert()` bilerek KAPSAM DIŞI: o bir
 * yazma işlemidir, cache'lenip tekrar oynatılması bir hataya dönüşürdü.
 */
@Injectable({ providedIn: 'root' })
export class PostgrestClient {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);
  private readonly transferState = inject(TransferState);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

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
    return this.cached(['list', resource, query], () =>
      this.http.get<T[]>(`${this.baseUrl}/${resource}`, {
        headers: this.headers,
        params: toParams(query),
      }),
    );
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

  /**
   * PostgREST RPC çağrısı (`POST /rpc/<fn>`). Yalnızca `stable`/`SECURITY
   * INVOKER` fonksiyonlar için kullanılır — bu istemci okuma amaçlıdır.
   */
  rpc<T>(fn: string, args: Record<string, string | number>): Observable<T> {
    return this.cached(['rpc', fn, args], () =>
      this.http.post<T>(`${this.baseUrl}/rpc/${fn}`, args, {
        headers: { ...this.headers, 'Content-Type': 'application/json' },
      }),
    );
  }

  /** Yazma yalnızca analytics olayları için; başka hiçbir yazma yolu yok. Cache'lenmez. */
  insert<T>(resource: string, payload: T | T[]): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${resource}`, payload, {
      headers: { ...this.headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    });
  }

  /**
   * Sunucuda: isteği yapar, sonucu `TransferState`'e yazar.
   * Tarayıcıda: `TransferState`'te varsa onu kullanır ve SİLER (yalnızca ilk
   * hydration okuması içindir; sonraki navigasyonlar taze veri ister), yoksa
   * normal bir istek yapar (saf CSR navigasyonu — ör. `/taksi`'den `/taksi/x`'e
   * tıklama).
   *
   * Anahtar, SSR ile hydration'daki İLK istek arasında aynı olmalıdır. Aynı
   * repository metodu aynı argüman sırasıyla her iki tarafta da çağrıldığı
   * için `JSON.stringify` deterministiktir.
   */
  private cached<T>(keyParts: readonly unknown[], request: () => Observable<T>): Observable<T> {
    const key = makeStateKey<T>(`pgrest:${JSON.stringify(keyParts)}`);

    if (this.isBrowser) {
      if (this.transferState.hasKey(key)) {
        const cachedValue = this.transferState.get<T | undefined>(key, undefined);
        this.transferState.remove(key);
        return of(cachedValue as T);
      }
      return request();
    }

    return request().pipe(tap((value) => this.transferState.set(key, value)));
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
