import type { ErrorHandler } from '@angular/core';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { APP_CONFIG } from '@core/config/app-config';

/**
 * Uygulama genelinde yakalanmamış hataların tek toplanma noktası.
 *
 * Faz 1'de davranış bilinçli olarak sade: sunucuda ve geliştirmede konsola yaz,
 * production tarayıcıda sessiz kal. Gerçek bir hata toplama servisi (§65) Faz 11'de
 * değerlendirilecek — MVP'yi şimdiden üçüncü parti servislerle şişirmiyoruz (§82).
 *
 * Buraya kullanıcı verisi loglanmaz (§56).
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly config = inject(APP_CONFIG);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));

  handleError(error: unknown): void {
    const context = this.isServer ? 'SSR' : 'browser';

    if (!this.config.production) {
      console.error(`[${context}] yakalanmamış hata:`, error);
      return;
    }

    // Production: mesajı logla, stack'i sunucuda tut. Tarayıcıda gürültü yapma.
    if (this.isServer) {
      console.error(`[SSR] yakalanmamış hata:`, normalizeError(error));
    }
  }
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}
