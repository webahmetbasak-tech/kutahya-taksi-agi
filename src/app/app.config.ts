import {
  ErrorHandler,
  provideBrowserGlobalErrorListeners,
  type ApplicationConfig,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withRouterConfig,
} from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';

import { routes } from './app.routes';
import { provideAppConfig } from '@core/config/app-config';
import { GlobalErrorHandler } from '@core/errors/global-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppConfig(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },

    provideRouter(
      routes,
      // Route parametrelerini doğrudan component input'una bağlar
      // (ör. /taksi/:slug -> TaxiDetailPage.slug).
      withComponentInputBinding(),
      // Sayfa değişiminde başa dön, aynı sayfadaki #bağlantılara kaydır.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      // Aynı URL'e tekrar gidildiğinde resolver'lar yeniden çalışsın (Faz 3'te önemli).
      withRouterConfig({ onSameUrlNavigation: 'reload' }),
    ),

    // `withFetch` SSR'da Node fetch kullanır; XHR bağımlılığını kaldırır.
    provideHttpClient(withFetch()),

    // Hydration + HTTP transfer cache: sunucuda çekilen veri HTML ile birlikte
    // taşınır, tarayıcı aynı isteği ikinci kez yapmaz (ARCHITECTURE.md §4).
    // POST'lar bilinçli olarak cache'lenmez.
    provideClientHydration(
      withHttpTransferCacheOptions({
        includePostRequests: false,
        filter: (req) => req.method === 'GET',
      }),
    ),
  ],
};
