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
    //
    // `includeRequestsWithAuthHeaders: true` KASITLIDIR ve gereklidir:
    // Angular varsayılan olarak `Authorization` header'ı taşıyan istekleri
    // cache DIŞI bırakır (kullanıcıya özel yanıtların transfer state'e
    // sızmaması için makul bir güvenlik varsayımı). PostgrestClient HER
    // isteğe `Authorization: Bearer <anon key>` ekler (bkz. postgrest.client.ts)
    // — ama bu anahtar herkes için AYNIDIR ve zaten client bundle'a giren
    // public bir değerdir, kullanıcıya özel bir kimlik bilgisi DEĞİLDİR.
    // Bu bayrak olmadan transfer cache SESSİZCE devre dışı kalır: SSR'da
    // çekilen veri hydration'da ikinci kez çekilirdi — tam da bu mimarinin
    // önlemeye çalıştığı şey (§4). Gerçek anahtar/oturum bazlı istekler
    // (Faz 7+, supabase-js ile) bu istemciden GEÇMEZ, bu yüzden risk yok.
    provideClientHydration(
      withHttpTransferCacheOptions({
        includePostRequests: false,
        includeRequestsWithAuthHeaders: true,
        filter: (req) => req.method === 'GET',
      }),
    ),
  ],
};
