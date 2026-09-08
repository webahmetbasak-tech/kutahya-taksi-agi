import { InjectionToken, type Provider } from '@angular/core';
import { environment, type AppEnvironment } from '@env';

/**
 * Ortam yapılandırmasına DI üzerinden erişim.
 *
 * Kod `environment`'ı doğrudan import etmek yerine bunu inject eder; böylece
 * testlerde sahte bir yapılandırma verilebilir ve SSR/browser ayrımı tek yerden
 * yönetilir.
 */
export const APP_CONFIG = new InjectionToken<AppEnvironment>('APP_CONFIG');

export function provideAppConfig(overrides?: Partial<AppEnvironment>): Provider {
  return {
    provide: APP_CONFIG,
    useValue: { ...environment, ...overrides } satisfies AppEnvironment,
  };
}
