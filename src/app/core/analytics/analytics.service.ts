import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { APP_CONFIG } from '@core/config/app-config';
import type { AnalyticsEventType as DbAnalyticsEventType } from '@core/data/models';
import { isLikelyBot } from './bot-detection';

const SESSION_STORAGE_KEY = 'kta_session_id';

/**
 * `analytics_event_type` DB enum'unun istemcinin göndermesine izin verilen alt
 * kümesi (`models.ts`teki `AnalyticsEventType` şemadan türer — burada elle
 * TEKRARLANMAZ). `listing_approved` HARİÇ TUTULUR: yalnızca admin onayında
 * SUNUCU (Postgres trigger/admin action) tarafından yazılır, istemci
 * servisinden asla gönderilmez.
 */
export type AnalyticsEventType = Exclude<DbAnalyticsEventType, 'listing_approved'>;

/**
 * `analytics_events_business_required` CHECK kısıtı işletmeye bağlı olmayan
 * olayları (`search_performed`, `listing_submitted`) ayırır — bu union o
 * kısıtı derleme zamanında da zorunlu kılar: diğer tüm olay tiplerinde
 * `businessId` zorunludur, bu ikisinde isteğe bağlıdır.
 */
export type AnalyticsEvent =
  | {
      eventType: 'search_performed' | 'listing_submitted';
      businessId?: string;
      metadata?: Record<string, unknown>;
    }
  | {
      eventType: Exclude<AnalyticsEventType, 'search_performed' | 'listing_submitted'>;
      businessId: string;
      metadata?: Record<string, unknown>;
    };

/**
 * En iyi çaba (best-effort), sessiz bir analytics gönderici.
 *
 * NEDEN `sendBeacon` DEĞİL, `fetch(..., {keepalive:true})`? (ARCHITECTURE.md §11)
 * Master prompt §11 `sendBeacon` istiyor, ancak `sendBeacon` özel HTTP başlığı
 * KABUL ETMEZ (yalnızca `Content-Type` çıkarımı yapılabilir) — PostgREST ise
 * her istekte `apikey`/`Authorization` başlığı zorunlu kılar ve bunun için
 * sorgu dizesi tabanlı bir alternatif sunmaz (bu yalnızca Supabase Realtime'a
 * özgüdür, PostgREST REST uç noktasına değil). `fetch` + `keepalive: true`,
 * `sendBeacon` ile AYNI garantiyi verir (sayfa kapansa/gezinilse bile isteği
 * tamamlar) ve başlık desteğini korur — bu yüzden tercih edildi.
 *
 * NEDEN SESSİZ? Analytics kullanıcı deneyimini asla bozmamalı: ağ hatası,
 * bot filtrelemesi, SSR ortamı — hepsi sessizce yutulur, hiçbir zaman throw
 * etmez veya UI'ı bekletmez.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly config = inject(APP_CONFIG);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  track(event: AnalyticsEvent): void {
    if (!this.isBrowser) {
      // SSR asla event üretmez — sunucu isteği gerçek bir ziyaretçiyi temsil etmez.
      return;
    }

    const userAgent = this.document.defaultView?.navigator.userAgent;
    if (isLikelyBot(userAgent)) {
      return;
    }

    const payload = {
      business_id: event.businessId ?? null,
      event_type: event.eventType,
      session_id: this.sessionId(),
      referrer_host: this.referrerHost(),
      landing_path: this.document.location.pathname,
      metadata: event.metadata ?? {},
    };

    const url = `${this.config.supabaseUrl}/rest/v1/analytics_events`;

    // Ateşle-ve-unut: `.catch()` ile hata yutulur, `await` edilmez — çağıran
    // kod (bir buton tıklaması) asla ağ gecikmesiyle bloklanmamalı.
    fetch(url, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: this.config.supabaseAnonKey,
        Authorization: `Bearer ${this.config.supabaseAnonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Analytics başarısızlığı sessizce yutulur (bkz. sınıf yorumu).
    });
  }

  private sessionId(): string {
    const storage = this.document.defaultView?.sessionStorage;
    const existing = storage?.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      return existing;
    }
    const id = crypto.randomUUID();
    storage?.setItem(SESSION_STORAGE_KEY, id);
    return id;
  }

  private referrerHost(): string | null {
    const referrer = this.document.referrer;
    if (!referrer) {
      return null;
    }
    try {
      return new URL(referrer).host;
    } catch {
      return null;
    }
  }
}
