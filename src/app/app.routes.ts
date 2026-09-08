import type { Routes } from '@angular/router';

/**
 * Uygulama route'ları.
 *
 * Her sayfa lazy loaded (`loadComponent`) — public kullanıcı yalnızca gördüğü
 * sayfanın kodunu indirir.
 *
 * BAŞLIK/META: statik `title:` alanları BİLEREK YOK. Faz 1'de her route burada
 * bir `title:` taşıyordu; Faz 4'te bu tek bir soruna dönüştü — sayfa hem
 * buradan hem kendi `SeoService.setPage()` çağrısından başlık alabiliyordu,
 * iki kaynak kolayca birbirinden sapardı. Artık HER sayfa kendi
 * `core/seo/seo.service.ts` çağrısıyla title/description/canonical/OG/robots'u
 * birlikte ayarlıyor — tek doğruluk kaynağı.
 *
 * URL'ler §43'e uyar: kısa, okunabilir, Türkçe karakter yok, küçük harf, tireli.
 * Render modları `app.routes.server.ts` içinde tanımlanır.
 *
 * `:slug` (sondan bir önceki route) DB'deki `landing_pages` tablosuna bağlı
 * SEO sayfalarını yakalar (ör. `/kutahya-724-taksi`). Diğer tüm route'lardan
 * SONRA tanımlı olması KRİTİKTİR — aksi halde ör. `/hakkinda` bu route'a
 * düşer ve asla `AboutPage`'e ulaşamaz (Angular Router ilk eşleşeni kullanır).
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('@features/home/home-page').then((m) => m.HomePage),
  },
  {
    path: 'taksi',
    loadComponent: () => import('@features/taxis/taxi-list-page').then((m) => m.TaxiListPage),
  },
  {
    path: 'taksi/:slug',
    loadComponent: () =>
      import('@features/taxi-detail/taxi-detail-page').then((m) => m.TaxiDetailPage),
  },
  {
    path: 'taksi/:slug/sahiplen',
    loadComponent: () => import('@features/claim/claim-page').then((m) => m.ClaimPage),
  },
  {
    path: 'bolge',
    loadComponent: () =>
      import('@features/locations/location-list-page').then((m) => m.LocationListPage),
  },
  {
    path: 'bolge/:slug',
    loadComponent: () =>
      import('@features/locations/location-detail-page').then((m) => m.LocationDetailPage),
  },
  {
    path: 'hizmet',
    loadComponent: () =>
      import('@features/services/service-list-page').then((m) => m.ServiceListPage),
  },
  {
    path: 'hizmet/:slug',
    loadComponent: () =>
      import('@features/services/service-detail-page').then((m) => m.ServiceDetailPage),
  },
  {
    path: 'isletme-ekle',
    loadComponent: () =>
      import('@features/business-submit/business-submit-page').then((m) => m.BusinessSubmitPage),
  },
  {
    path: 'hakkinda',
    loadComponent: () => import('@features/legal/about-page').then((m) => m.AboutPage),
  },
  {
    path: 'gizlilik',
    loadComponent: () => import('@features/legal/privacy-page').then((m) => m.PrivacyPage),
  },
  {
    path: 'panel',
    loadComponent: () => import('@features/dashboard/dashboard-page').then((m) => m.DashboardPage),
  },
  {
    path: 'giris',
    loadComponent: () => import('@features/auth/auth-page').then((m) => m.AuthPage),
  },
  {
    path: ':slug',
    loadComponent: () => import('@features/landing/landing-page').then((m) => m.LandingPage),
  },
  {
    path: '**',
    loadComponent: () => import('@features/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
