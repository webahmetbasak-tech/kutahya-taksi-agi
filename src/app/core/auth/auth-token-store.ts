import { Injectable, signal } from '@angular/core';

/**
 * `AuthService`nin (supabase-js sarmalayıcısı) o an geçerli erişim tokenını
 * `PostgrestClient`e sızdırmadan aktardığı ince, bağımsız sinyal deposu.
 *
 * NEDEN AYRI BİR SINIF? `PostgrestClient` her sayfada (SSR dahil) kullanılan
 * temel bir servistir; `AuthService` ise `@supabase/supabase-js`'i içe aktarır
 * ve YALNIZCA lazy auth/panel/sahiplen chunk'larında bulunmalıdır
 * (ARCHITECTURE.md §4). `PostgrestClient` doğrudan `AuthService`yi inject
 * etseydi, supabase-js paketi tüm sayfaların paylaştığı ana pakete sızardı.
 * Bu depo hiçbir harici paket içe aktarmaz — `PostgrestClient` bunu güvenle
 * kök enjektörden alabilir.
 */
@Injectable({ providedIn: 'root' })
export class AuthTokenStore {
  private readonly _accessToken = signal<string | null>(null);

  /** Oturum açık değilse `null` — bu durumda `PostgrestClient` anon anahtara döner. */
  readonly accessToken = this._accessToken.asReadonly();

  set(token: string | null): void {
    this._accessToken.set(token);
  }
}
