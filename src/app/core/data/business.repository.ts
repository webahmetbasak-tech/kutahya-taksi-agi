import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { PostgrestClient } from './postgrest.client';
import {
  BUSINESS_CARD_FIELDS,
  BUSINESS_DETAIL_FIELDS,
  type BusinessCard,
  type BusinessDetail,
  type NearbyBusinessRow,
} from './models';

/**
 * İşletme okuma sorguları.
 *
 * NOT: `status = 'active'` filtresi burada AYRICA yazılmaz. RLS zaten yalnızca
 * aktif işletmeleri döndürür (§54); filtreyi iki yerde tutmak, ileride biri
 * değişirse sessiz tutarsızlık üretirdi. Güvenlik sınırı tek yerde: veritabanında.
 */
@Injectable({ providedIn: 'root' })
export class BusinessRepository {
  private readonly client = inject(PostgrestClient);

  /** Yayındaki işletmeler. */
  list(limit = 50): Observable<BusinessCard[]> {
    return this.client.list<BusinessCard>('businesses', {
      select: BUSINESS_CARD_FIELDS,
      order: 'business_name.asc',
      limit,
    });
  }

  /** Slug ile tek işletme; bulunamazsa `null`. */
  bySlug(slug: string): Observable<BusinessDetail | null> {
    return this.client.single<BusinessDetail>('businesses', {
      select: BUSINESS_DETAIL_FIELDS,
      slug: `eq.${slug}`,
    });
  }

  /**
   * Belirli bir bölgede hizmet veren işletmeler (§12, `business_locations`).
   *
   * `business_locations` üzerinden embed edilir; görünürlük o tablonun RLS'i
   * ile aynı kurala (bağlı işletme aktifse görünür) otomatik uyar.
   */
  byLocation(locationId: string): Observable<BusinessCard[]> {
    return this.client
      .list<{ business: BusinessCard }>('business_locations', {
        select: `business:businesses(${BUSINESS_CARD_FIELDS})`,
        location_id: `eq.${locationId}`,
      })
      .pipe(map((rows) => sortByName(rows.map((row) => row.business))));
  }

  /** Belirli bir hizmeti veren işletmeler (§10, `business_services`). */
  byService(serviceId: string): Observable<BusinessCard[]> {
    return this.client
      .list<{ business: BusinessCard }>('business_services', {
        select: `business:businesses(${BUSINESS_CARD_FIELDS})`,
        service_id: `eq.${serviceId}`,
      })
      .pipe(map((rows) => sortByName(rows.map((row) => row.business))));
  }

  /**
   * Konuma en yakın aktif işletmeler (§49 "Yakınımdaki Taksiler").
   *
   * `nearby_businesses` RPC'sini çağırır — PostGIS `ST_DWithin` bunu Faz 2'de
   * kurulan GIST index üzerinden çalıştırır. RLS'i bypass etmez (RPC
   * `SECURITY INVOKER`); yalnızca zaten görünür olan satırlara mesafe filtresi
   * ekler.
   */
  nearby(
    latitude: number,
    longitude: number,
    radiusMeters = 15000,
  ): Observable<NearbyBusinessRow[]> {
    return this.client.rpc<NearbyBusinessRow[]>('nearby_businesses', {
      lat: latitude,
      lon: longitude,
      radius_meters: radiusMeters,
    });
  }

  /**
   * Eski slug ile taşınmış işletmeyi bulur (§64).
   * Faz 4'te 301 yönlendirmesi bunu kullanacak.
   */
  currentSlugForOldSlug(oldSlug: string): Observable<{ businesses: { slug: string } } | null> {
    return this.client.single<{ businesses: { slug: string } }>('business_slug_history', {
      select: 'businesses(slug)',
      old_slug: `eq.${oldSlug}`,
    });
  }
}

function sortByName<T extends { business_name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.business_name.localeCompare(b.business_name, 'tr'));
}
