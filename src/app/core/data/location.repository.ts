import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { PostgrestClient } from './postgrest.client';
import type { LocationRow } from './models';

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
      select: 'id,slug,name,type,parent_id,latitude,longitude',
      type: 'eq.district',
      order: 'name.asc',
    });
  }

  bySlug(slug: string): Observable<LocationRow | null> {
    return this.client.single<LocationRow>('locations', {
      select: 'id,slug,name,type,parent_id,description,latitude,longitude',
      slug: `eq.${slug}`,
    });
  }
}
