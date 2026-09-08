import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { PostgrestClient } from './postgrest.client';
import type { Service } from './models';

/** Hizmet türü okuma sorguları (§10). */
@Injectable({ providedIn: 'root' })
export class ServiceRepository {
  private readonly client = inject(PostgrestClient);

  list(): Observable<Service[]> {
    return this.client.list<Service>('services', {
      select: 'id,slug,name,description',
      is_active: 'eq.true',
      order: 'sort_order.asc',
    });
  }

  bySlug(slug: string): Observable<Service | null> {
    return this.client.single<Service>('services', {
      select: 'id,slug,name,description',
      slug: `eq.${slug}`,
      is_active: 'eq.true',
    });
  }
}
