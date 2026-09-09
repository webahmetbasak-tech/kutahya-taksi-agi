import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { PostgrestClient } from './postgrest.client';
import type { AdminReviewRow, ReviewStatus } from './models';

const ADMIN_REVIEW_FIELDS = 'id,business_id,rating,review_text,status,created_at,business:businesses(business_name,slug)';

/**
 * Admin panelde (Faz 9b) review moderasyonu. Onay/red düz `PATCH`'tir —
 * `claims`in aksine burada çok kolonlu bir CHECK kısıtı/cascade yan etkisi
 * yok, RLS (`reviews_admin_all`) tek başına yeterli.
 */
@Injectable({ providedIn: 'root' })
export class AdminReviewRepository {
  private readonly client = inject(PostgrestClient);

  all(status?: ReviewStatus): Observable<AdminReviewRow[]> {
    return this.client.list<AdminReviewRow>('reviews', {
      select: ADMIN_REVIEW_FIELDS,
      ...(status ? { status: `eq.${status}` } : {}),
      order: 'created_at.desc',
    });
  }

  countPending(): Observable<number> {
    return this.client
      .list<{ id: string }>('reviews', { select: 'id', status: 'eq.pending' })
      .pipe(map((rows) => rows.length));
  }

  moderate(id: string, status: ReviewStatus): Observable<void> {
    return this.client.update<AdminReviewRow>('reviews', { id: `eq.${id}` }, { status });
  }
}
