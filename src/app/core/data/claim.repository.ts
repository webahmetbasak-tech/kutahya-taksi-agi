import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { PostgrestClient } from './postgrest.client';
import type { ClaimRow } from './models';

const CLAIM_FIELDS = 'id,business_id,status,verification_method,submitted_at,reviewer_note';

/**
 * Sahiplenme talebi (claim) okuma/yazma sorguları (Faz 7 — §14).
 *
 * Güvenlik sınırı burada TEKRARLANMAZ: `claims_insert_own` RLS politikası
 * (bkz. `20260908150400_rls.sql`) zaten "işletme aktif mi", "sahibi var mı",
 * "başvuru pending mi başlıyor" kurallarını veritabanında zorunlu kılar. Bu
 * repository yalnızca isteği doğru gövdeyle gönderir; reddedilen bir istek
 * (ör. işletme zaten sahiplenilmiş) burada değil, sayfanın hata işleyicisinde
 * kullanıcıya dürüst bir mesajla gösterilir.
 */
@Injectable({ providedIn: 'root' })
export class ClaimRepository {
  private readonly client = inject(PostgrestClient);

  submit(params: {
    businessId: string;
    userId: string;
    contactPhoneE164: string | null;
    note: string | null;
  }): Observable<void> {
    return this.client.insert('claims', {
      business_id: params.businessId,
      user_id: params.userId,
      contact_phone_e164: params.contactPhoneE164,
      note: params.note,
    });
  }

  /** Oturum açmış kullanıcının kendi talepleri (en yeni önce). */
  mine(userId: string): Observable<ClaimRow[]> {
    return this.client.list<ClaimRow>('claims', {
      select: CLAIM_FIELDS,
      user_id: `eq.${userId}`,
      order: 'submitted_at.desc',
    });
  }
}
