import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { PostgrestClient } from './postgrest.client';
import type { Service, ServiceInsert } from './models';

const SERVICE_FIELDS = 'id,slug,name,description,sort_order,is_active,created_at';

/**
 * Admin panelde (Faz 9b) hizmet yönetimi — `service.repository.ts` (public,
 * yalnızca `is_active=true` okur) BİLEREK ayrı: admin pasif hizmetleri de görmeli.
 *
 * BİLİNÇLİ SINIRLAMA: sert `DELETE` YOK — `business_services.service_id`
 * `on delete cascade` olduğu için bir hizmeti silmek, o hizmeti sunan
 * işletmelerin etiketini SESSİZCE kaldırırdı. Bunun yerine `is_active` ile
 * yayından kaldırılır (`services_select_active` RLS'i zaten bunu public'ten
 * gizler); veri kaybı riski yok.
 */
@Injectable({ providedIn: 'root' })
export class AdminServiceRepository {
  private readonly client = inject(PostgrestClient);

  all(): Observable<Service[]> {
    return this.client.list<Service>('services', { select: SERVICE_FIELDS, order: 'sort_order.asc' });
  }

  create(input: ServiceInsert): Observable<void> {
    return this.client.insert('services', input);
  }

  update(id: string, patch: Partial<Service>): Observable<void> {
    return this.client.update<Service>('services', { id: `eq.${id}` }, patch);
  }

  setActive(id: string, isActive: boolean): Observable<void> {
    return this.update(id, { is_active: isActive });
  }
}
