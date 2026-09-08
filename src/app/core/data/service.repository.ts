import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { PostgrestClient } from './postgrest.client';
import type { Service } from './models';

const SERVICE_FIELDS = 'id,slug,name,description';

/** Hizmet türü okuma sorguları (§10). */
@Injectable({ providedIn: 'root' })
export class ServiceRepository {
  private readonly client = inject(PostgrestClient);

  list(): Observable<Service[]> {
    return this.client.list<Service>('services', {
      select: SERVICE_FIELDS,
      is_active: 'eq.true',
      order: 'sort_order.asc',
    });
  }

  bySlug(slug: string): Observable<Service | null> {
    return this.client.single<Service>('services', {
      select: SERVICE_FIELDS,
      slug: `eq.${slug}`,
      is_active: 'eq.true',
    });
  }

  /**
   * Bir işletmenin sunduğu hizmetler (§42 entity ilişkileri —
   * "Zümrüt Taksi → 7/24 Taksi" yönü). Detay sayfasının kendi hizmet
   * varlıklarına GERİ link vermesi için; `business_services` üzerinden embed.
   */
  forBusiness(businessId: string): Observable<Service[]> {
    return this.client
      .list<{ service: Service }>('business_services', {
        select: `service:services(${SERVICE_FIELDS})`,
        business_id: `eq.${businessId}`,
      })
      .pipe(map((rows) => rows.map((row) => row.service)));
  }
}
