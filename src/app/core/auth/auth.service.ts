import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { APP_CONFIG } from '@core/config/app-config';
import { AuthTokenStore } from './auth-token-store';
import { translateAuthError } from './auth-errors';

export interface AuthUser {
  readonly id: string;
  readonly email: string | null;
}

/**
 * Supabase Auth sarmalayıcısı (Faz 7).
 *
 * BİLEREK YALNIZCA BURADA `@supabase/supabase-js` içe aktarılır. Public okuma
 * yolu `PostgrestClient` üzerinden `HttpClient`le gider (ARCHITECTURE.md §4);
 * bu servis yalnızca `/giris`, `/taksi/:slug/sahiplen` ve `/panel` gibi lazy
 * chunk'larda inject edildiği için supabase-js ana pakete SIZMAZ.
 *
 * SSR GÜVENLİĞİ: oturum `sessionStorage`/`localStorage`da tutulur, bu yüzden
 * yalnızca tarayıcıda başlatılır. SSR'da `ready` doğrudan `true` yapılır —
 * bu servisi inject eden sayfalar zaten `RenderMode.Client`tir, yani sunucuda
 * hiç anlamlı içerik render etmezler; `ready=true` yalnızca senkron bir
 * "oturum yok" kararını engellememek içindir.
 *
 * E-POSTA ONAYI: canlı projede doğrulandı (bkz. PROJECT_PLAN.md Faz 7 notu) —
 * Supabase varsayılanı e-posta onayını ZORUNLU kılıyor. `signUp()` bu yüzden
 * bir oturum DEĞİL, "onay bekleniyor" durumunu da ayırt edebilen bir sonuç
 * döner; sayfa buna göre "e-postanızı kontrol edin" mesajı gösterir.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly config = inject(APP_CONFIG);
  private readonly tokenStore = inject(AuthTokenStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private client: SupabaseClient | null = null;

  private readonly _ready = signal(false);
  readonly ready = this._ready.asReadonly();

  private readonly _user = signal<AuthUser | null>(null);
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  constructor() {
    if (!this.isBrowser) {
      this._ready.set(true);
      return;
    }

    const supabase = this.getClient();

    supabase.auth.getSession().then(({ data }) => {
      this.applySession(data.session);
      this._ready.set(true);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      this.applySession(session);
    });
  }

  /**
   * @returns başarılıysa `{ confirmed: false }` (e-posta onayı bekleniyor —
   * bu proje ayarında oturum HEMEN açılmaz), hata varsa `{ error }`.
   */
  async signUp(email: string, password: string): Promise<{ confirmed: boolean } | { error: string }> {
    const { data, error } = await this.getClient().auth.signUp({ email, password });
    if (error) {
      return { error: translateAuthError(error) };
    }
    return { confirmed: data.session !== null };
  }

  async signIn(email: string, password: string): Promise<{ error: string } | undefined> {
    const { error } = await this.getClient().auth.signInWithPassword({ email, password });
    return error ? { error: translateAuthError(error) } : undefined;
  }

  async signOut(): Promise<void> {
    await this.getClient().auth.signOut();
  }

  private getClient(): SupabaseClient {
    this.client ??= createClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
    return this.client;
  }

  private applySession(session: Session | null): void {
    this.tokenStore.set(session?.access_token ?? null);
    this._user.set(session ? { id: session.user.id, email: session.user.email ?? null } : null);
  }
}
