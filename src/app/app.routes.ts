import type { Routes } from '@angular/router';

/**
 * Uygulama route'ları.
 *
 * Her sayfa lazy loaded (`loadComponent`) — public kullanıcı yalnızca gördüğü
 * sayfanın kodunu indirir. `title` Angular'ın yerleşik başlık yönetimini kullanır;
 * veriye bağlı dinamik başlıklar ve meta/canonical/OG Faz 4'teki SEO motorunda
 * merkezîleşecek.
 *
 * URL'ler §43'e uyar: kısa, okunabilir, Türkçe karakter yok, küçük harf, tireli.
 * Render modları `app.routes.server.ts` içinde tanımlanır.
 */
export const routes: Routes = [
  {
    path: '',
    title: "Kütahya Taksi Ağı — Kütahya'da Taksi Bul",
    loadComponent: () => import('@features/home/home-page').then((m) => m.HomePage),
  },
  {
    path: 'taksi',
    title: 'Kütahya Taksileri — Kütahya Taksi Ağı',
    loadComponent: () => import('@features/taxis/taxi-list-page').then((m) => m.TaxiListPage),
  },
  {
    path: 'taksi/:slug',
    loadComponent: () =>
      import('@features/taxi-detail/taxi-detail-page').then((m) => m.TaxiDetailPage),
  },
  {
    path: 'isletme-ekle',
    title: 'İşletmemi Yayınla — Kütahya Taksi Ağı',
    loadComponent: () =>
      import('@features/business-submit/business-submit-page').then((m) => m.BusinessSubmitPage),
  },
  {
    path: 'hakkinda',
    title: 'Hakkında — Kütahya Taksi Ağı',
    loadComponent: () => import('@features/legal/about-page').then((m) => m.AboutPage),
  },
  {
    path: 'gizlilik',
    title: 'Gizlilik — Kütahya Taksi Ağı',
    loadComponent: () => import('@features/legal/privacy-page').then((m) => m.PrivacyPage),
  },
  {
    path: 'panel',
    title: 'İşletme Paneli — Kütahya Taksi Ağı',
    loadComponent: () => import('@features/dashboard/dashboard-page').then((m) => m.DashboardPage),
  },
  {
    path: '**',
    title: 'Sayfa bulunamadı — Kütahya Taksi Ağı',
    loadComponent: () => import('@features/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
