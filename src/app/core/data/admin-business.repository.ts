import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { PostgrestClient } from './postgrest.client';
import type { AdminBusinessRow, AdminQuickAddInput, AdminQuickAddResult, BusinessStatus } from './models';

const ADMIN_BUSINESS_FIELDS = [
  'id',
  'slug',
  'business_name',
  'status',
  'verification_status',
  'plan',
  'phone_e164',
  'phone_display',
  'whatsapp_e164',
  'district',
  'neighborhood',
  'city',
  'address',
  'website',
  'description',
  'owner_id',
  'possible_duplicate_of',
  'source_type',
  'category_id',
  'created_at',
  'updated_at',
  'last_verified_at',
].join(',');

/**
 * Admin panelde (Faz 9a) TÜM işletmeler için okuma/yazma — `business.repository.ts`
 * BİLEREK ayrı tutuldu: o yalnızca public/owner okumaları için (RLS zaten
 * `status='active'`e daraltır), bu ise admin-only kolonları da okur/yazar.
 * RLS (`businesses_select_admin`, `businesses_admin_all`) tek güvenlik sınırı;
 * bu repository yalnızca doğru isteği gönderir.
 */
@Injectable({ providedIn: 'root' })
export class AdminBusinessRepository {
  private readonly client = inject(PostgrestClient);

  /** `status` verilmezse TÜMÜ (admin görünümü — pending/active/suspended/rejected/archived hepsi). */
  all(status?: BusinessStatus): Observable<AdminBusinessRow[]> {
    return this.client.list<AdminBusinessRow>('businesses', {
      select: ADMIN_BUSINESS_FIELDS,
      ...(status ? { status: `eq.${status}` } : {}),
      order: 'created_at.desc',
    });
  }

  byId(id: string): Observable<AdminBusinessRow | null> {
    return this.client.single<AdminBusinessRow>('businesses', {
      select: ADMIN_BUSINESS_FIELDS,
      id: `eq.${id}`,
    });
  }

  /** Yalnızca "dikkat gerektiren" sayım için — küçük veri setinde (§80) tam liste çekmek yeterince ucuz. */
  countPending(): Observable<number> {
    return this.client
      .list<{ id: string }>('businesses', { select: 'id', status: 'eq.pending' })
      .pipe(map((rows) => rows.length));
  }

  updateStatus(id: string, status: BusinessStatus): Observable<void> {
    return this.client.update<AdminBusinessRow>('businesses', { id: `eq.${id}` }, { status });
  }

  updateFields(id: string, patch: Partial<AdminBusinessRow>): Observable<void> {
    return this.client.update<AdminBusinessRow>('businesses', { id: `eq.${id}` }, patch);
  }

  /** §52 — olası kopya işaretini kaldır (kopya DEĞİL kararı). */
  dismissDuplicate(id: string): Observable<void> {
    return this.client.update<AdminBusinessRow>(
      'businesses',
      { id: `eq.${id}` },
      { possible_duplicate_of: null },
    );
  }

  /** Hızlı veri girişi (§51) — `admin_quick_add_business` RPC'si. */
  quickAdd(input: AdminQuickAddInput): Observable<AdminQuickAddResult> {
    return this.client.mutateRpc<AdminQuickAddResult>('admin_quick_add_business', input).pipe(
      map((rows) => {
        const row = rows[0];
        if (!row) {
          throw new Error('admin_quick_add_business boş sonuç döndü.');
        }
        return row;
      }),
    );
  }
}
