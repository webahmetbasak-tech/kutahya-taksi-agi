import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { PostgrestClient } from './postgrest.client';
import type { LocationRow } from './models';

const LOCATION_FIELDS = 'id,slug,name,type,parent_id,latitude,longitude,description';

/**
 * Lokasyon okuma sorguları (§12).
 *
 * `locations` herkese açık okunur (RLS: locations_select_all) — sahiplik
 * filtresi yoktur, bu yüzden BusinessRepository'nin aksine burada "yalnızca
 * tek yerde filtrele" kaygısı geçerli değil.
 */
@Injectable({ providedIn: 'root' })
export class LocationRepository {
  private readonly client = inject(PostgrestClient);

  /** Tüm ilçeler, isme göre sıralı — bölge sayfaları ve internal linking için. */
  districts(): Observable<LocationRow[]> {
    return this.client.list<LocationRow>('locations', {
      select: LOCATION_FIELDS,
      type: 'eq.district',
      order: 'name.asc',
    });
  }

  /** Önemli noktalar (havalimanı, otogar, üniversite…) — internal linking için. */
  landmarks(): Observable<LocationRow[]> {
    return this.client.list<LocationRow>('locations', {
      select: LOCATION_FIELDS,
      type: `in.(landmark,airport,bus_station,university,hospital)`,
      order: 'name.asc',
    });
  }

  bySlug(slug: string): Observable<LocationRow | null> {
    return this.client.single<LocationRow>('locations', {
      select: LOCATION_FIELDS,
      slug: `eq.${slug}`,
    });
  }
}
