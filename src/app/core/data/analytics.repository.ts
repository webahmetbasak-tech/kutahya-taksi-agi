import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { PostgrestClient } from './postgrest.client';
import type { AnalyticsDailyRow } from './models';

const ANALYTICS_DAILY_FIELDS = 'day,event_type,event_count';

/**
 * Panel istatistik okuma sorguları (Faz 6 — PROJECT_PLAN.md "dashboard istatistik
 * sorguları").
 *
 * BURADA AUTH YOK: RLS politikası `analytics_daily_select_own` zaten yalnızca
 * ilgili işletmenin sahibine veya admin'e satır döndürür (bkz.
 * `20260908150100_core_tables.sql`) — bu repository güvenlik sınırını
 * TEKRARLAMAZ, PostgrestClient anon anahtarla istek atar ve Postgres kararı
 * verir. Yetkisiz bir kullanıcı için bu metot her zaman boş dizi döner (satır
 * yok demek değil — RLS'in gizlediği anlamına gelir), asla hata fırlatmaz.
 *
 * Bu metodun ÇAĞRILDIĞI bir panel UI'ı henüz yok — Faz 7'nin auth/claim
 * sistemi olmadan "giriş yapmış işletme sahibi" kavramı yok. Repository
 * şimdiden yazıldı çünkü sorgu şekli veritabanı şemasına bağlıdır ve Faz 6'nın
 * kapsamına dahildir; `dashboard-page.ts` bunu Faz 7'de `inject` edip
 * kullanacak.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsRepository {
  private readonly client = inject(PostgrestClient);

  /** Bir işletmenin son N güne ait günlük event özetleri (varsayılan 30 gün). */
  dailyStats(businessId: string, sinceDays = 30): Observable<AnalyticsDailyRow[]> {
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return this.client.list<AnalyticsDailyRow>('analytics_daily', {
      select: ANALYTICS_DAILY_FIELDS,
      business_id: `eq.${businessId}`,
      day: `gte.${since}`,
      order: 'day.desc',
    });
  }
}
