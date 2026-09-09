import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { PostgrestClient } from './postgrest.client';
import type { AdminClaimRow, ClaimStatus } from './models';

const ADMIN_CLAIM_FIELDS = [
  'id',
  'business_id',
  'user_id',
  'status',
  'verification_method',
  'contact_phone_e164',
  'note',
  'reviewer_note',
  'submitted_at',
  'approved_at',
  'rejected_at',
  'reviewed_by',
].join(',');

/**
 * Admin panelde (Faz 9a) claim inceleme — `claim.repository.ts` (sahibin
 * kendi talepleri) BİLEREK ayrı: onay/red `approve_claim`/`reject_claim`
 * RPC'lerinden geçer (bkz. migration yorumu — `claims_status_timestamps`
 * CHECK kısıtını çıplak bir UPDATE'in doğru kurması hataya açık).
 */
@Injectable({ providedIn: 'root' })
export class AdminClaimRepository {
  private readonly client = inject(PostgrestClient);

  all(status?: ClaimStatus): Observable<AdminClaimRow[]> {
    return this.client.list<AdminClaimRow>('claims', {
      select: ADMIN_CLAIM_FIELDS,
      ...(status ? { status: `eq.${status}` } : {}),
      order: 'submitted_at.desc',
    });
  }

  countPending(): Observable<number> {
    return this.client
      .list<{ id: string }>('claims', { select: 'id', status: 'eq.pending' })
      .pipe(map((rows) => rows.length));
  }

  approve(claimId: string, note?: string): Observable<void> {
    return this.client
      .mutateRpc<null>('approve_claim', { p_claim_id: claimId, ...(note ? { p_note: note } : {}) })
      .pipe(map((): void => undefined));
  }

  reject(claimId: string, note?: string): Observable<void> {
    return this.client
      .mutateRpc<null>('reject_claim', { p_claim_id: claimId, ...(note ? { p_note: note } : {}) })
      .pipe(map((): void => undefined));
  }
}
