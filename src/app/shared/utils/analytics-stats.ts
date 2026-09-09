import type { AnalyticsDailyRow } from '@core/data/models';

/**
 * Günlük event satırlarını (Faz 6) tek bir özet nesnesine indirger.
 *
 * `DashboardPage` (Faz 7, sahibin kendi istatistikleri) ve
 * `AdminAnalyticsPage` (Faz 9b, admin'in seçtiği herhangi bir işletme)
 * AYNI mantığı paylaşır — RLS zaten hangi satırların döneceğini belirliyor
 * (`analytics_daily_select_own`), burada yalnızca toplama var.
 */
export interface BusinessStats {
  profileViews: number;
  callClicks: number;
  whatsappClicks: number;
  directionsClicks: number;
}

export const EMPTY_BUSINESS_STATS: BusinessStats = {
  profileViews: 0,
  callClicks: 0,
  whatsappClicks: 0,
  directionsClicks: 0,
};

export function summarizeDailyStats(rows: AnalyticsDailyRow[]): BusinessStats {
  const stats = { ...EMPTY_BUSINESS_STATS };
  for (const row of rows) {
    switch (row.event_type) {
      case 'profile_view':
        stats.profileViews += row.event_count;
        break;
      case 'call_click':
        stats.callClicks += row.event_count;
        break;
      case 'whatsapp_click':
        stats.whatsappClicks += row.event_count;
        break;
      case 'directions_click':
        stats.directionsClicks += row.event_count;
        break;
    }
  }
  return stats;
}
