import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { PostgrestClient } from './postgrest.client';
import type { RequestRemovalInput } from './models';

/**
 * KVKK profil kaldırma talebi (Faz 9c, §56) — `request_business_removal`
 * RPC'si `anon` dahil herkese açık (oturum açmamış bir taksici de talep
 * edebilmeli). Doğrudan `INSERT` policy YOK; tüm doğrulama RPC'de.
 */
@Injectable({ providedIn: 'root' })
export class RemovalRequestRepository {
  private readonly client = inject(PostgrestClient);

  request(input: RequestRemovalInput): Observable<void> {
    return this.client
      .mutateRpc<{ id: string }>('request_business_removal', input)
      .pipe(map((): void => undefined));
  }
}
