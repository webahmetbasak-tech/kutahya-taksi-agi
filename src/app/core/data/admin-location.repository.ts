import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { PostgrestClient } from './postgrest.client';
import type { LocationRow, LocationInsert } from './models';

const LOCATION_FIELDS =
  'id,slug,name,type,parent_id,latitude,longitude,description,source_type,is_active,created_at';

/**
 * Admin panelde (Faz 9b) lokasyon yönetimi — `location.repository.ts`
 * (public, yalnızca district/landmark okur) BİLEREK ayrı: admin TÜM tipleri
 * (mahalle dahil — hiç girilmemiş, bkz. reference_data.sql) görüp ekleyebilmeli.
 *
 * BİLİNÇLİ SINIRLAMA: sert `DELETE` YOK — `business_locations.location_id`
 * `on delete cascade`, `landing_pages.location_id` `on delete set null`;
 * bir lokasyonu silmek işletme/landing page ilişkilerini SESSİZCE bozardı.
 * `is_active` ile aktif/pasif yapılır (aynı desen `AdminServiceRepository`de) —
 * pasif bir lokasyon public sayfalarda/sitemap'ta/llms.txt'te gizlenir ama
 * ilişkileri korunur.
 */
@Injectable({ providedIn: 'root' })
export class AdminLocationRepository {
  private readonly client = inject(PostgrestClient);

  all(): Observable<LocationRow[]> {
    return this.client.list<LocationRow>('locations', { select: LOCATION_FIELDS, order: 'name.asc' });
  }

  create(input: LocationInsert): Observable<void> {
    return this.client.insert('locations', input);
  }

  update(id: string, patch: Partial<LocationRow>): Observable<void> {
    return this.client.update<LocationRow>('locations', { id: `eq.${id}` }, patch);
  }

  setActive(id: string, isActive: boolean): Observable<void> {
    return this.update(id, { is_active: isActive });
  }
}
