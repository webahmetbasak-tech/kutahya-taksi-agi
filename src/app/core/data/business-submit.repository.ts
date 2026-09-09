import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { PostgrestClient } from './postgrest.client';
import type { BusinessSubmitInput, BusinessSubmitResult } from './models';

/**
 * İşletme öz-başvurusu (Faz 8, §26).
 *
 * Güvenlik sınırı burada TEKRARLANMAZ: doğrulama, telefon normalizasyonu,
 * slug üretimi ve olası kopya işaretleme (§52) tek atomik `submit_business`
 * RPC'sinde yapılır (bkz. `20260909130000_business_submission.sql`). Bu
 * repository yalnızca isteği doğru gövdeyle gönderir.
 */
@Injectable({ providedIn: 'root' })
export class BusinessSubmitRepository {
  private readonly client = inject(PostgrestClient);

  submit(input: BusinessSubmitInput): Observable<BusinessSubmitResult> {
    return this.client.mutateRpc<BusinessSubmitResult>('submit_business', input).pipe(
      map((rows) => {
        const row = rows[0];
        if (!row) {
          throw new Error('submit_business boş sonuç döndü.');
        }
        return row;
      }),
    );
  }
}
