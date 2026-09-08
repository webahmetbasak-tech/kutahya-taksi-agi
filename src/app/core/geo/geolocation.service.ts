import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Tarayıcı konum izni sarmalayıcısı (§49).
 *
 * Konum İZİN VERİLMEDEN de site çalışmaya devam etmelidir — bu yüzden hata
 * fırlatmak yerine her zaman `null` ile çözülür (reddetme, timeout, SSR,
 * tarayıcı desteği yok — hepsi aynı "konum alınamadı" sonucuna gider).
 * Çağıran taraf `null` durumunda Kütahya Merkez'e düşer.
 */
@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  requestLocation(): Promise<Coordinates | null> {
    if (!this.isBrowser || !('geolocation' in navigator)) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        () => resolve(null),
        { timeout: 8000, maximumAge: 5 * 60 * 1000 },
      );
    });
  }
}
