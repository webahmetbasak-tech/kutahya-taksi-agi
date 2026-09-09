import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { PostgrestClient } from './postgrest.client';
import type { AdminRemovalRequestRow, RemovalRequest, RemovalRequestStatus } from './models';

const ADMIN_REMOVAL_FIELDS =
  'id,business_id,reason,contact_email,status,created_at,business:businesses(business_name,slug)';

/** Admin panelde (Faz 9c) KVKK kaldırma talebi kuyruğu. */
@Injectable({ providedIn: 'root' })
export class AdminRemovalRequestRepository {
  private readonly client = inject(PostgrestClient);

  all(status?: RemovalRequestStatus): Observable<AdminRemovalRequestRow[]> {
    return this.client.list<AdminRemovalRequestRow>('removal_requests', {
      select: ADMIN_REMOVAL_FIELDS,
      ...(status ? { status: `eq.${status}` } : {}),
      order: 'created_at.desc',
    });
  }

  countPending(): Observable<number> {
    return this.client
      .list<{ id: string }>('removal_requests', { select: 'id', status: 'eq.pending' })
      .pipe(map((rows) => rows.length));
  }

  /**
   * `completed`/`dismissed` — `resolved_at` CHECK kısıtı gereği zorunlu; `resolvedBy`
   * (çağıran admin'in `auth.uid()`'i) denetlenebilirlik için gönderilir — sunucu
   * tarafında otomatik doldurulmuyor (bu basit bir `PATCH`, `claims`in RPC'sindeki
   * gibi `auth.uid()` okuyan bir SQL fonksiyonu değil).
   */
  resolve(
    id: string,
    status: Extract<RemovalRequestStatus, 'completed' | 'dismissed'>,
    resolvedBy: string,
  ): Observable<void> {
    return this.client.update<RemovalRequest>(
      'removal_requests',
      { id: `eq.${id}` },
      { status, resolved_at: new Date().toISOString(), resolved_by: resolvedBy },
    );
  }
}
