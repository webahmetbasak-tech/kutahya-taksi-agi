import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { PostgrestClient } from './postgrest.client';
import type { ProfileRow } from './models';

const PROFILE_FIELDS = 'id,full_name,phone_e164,role,created_at';

/**
 * `profiles` okuma/yazma sorguları.
 *
 * `mine()` — oturum açmış kullanıcının kendi profili; `AdminAccessService`
 * (Faz 9) admin olup olmadığını buradan öğrenir. RLS (`profiles_select_own`)
 * zaten yalnızca kendi satırına/adminse hepsine izin verir.
 */
@Injectable({ providedIn: 'root' })
export class ProfileRepository {
  private readonly client = inject(PostgrestClient);

  mine(userId: string): Observable<ProfileRow | null> {
    return this.client.single<ProfileRow>('profiles', {
      select: PROFILE_FIELDS,
      id: `eq.${userId}`,
    });
  }

  /** Admin panelde (Faz 9c) tüm kullanıcılar — RLS `profiles_select_own` admin'i `is_admin()` OR'uyla kapsar. */
  all(): Observable<ProfileRow[]> {
    return this.client.list<ProfileRow>('profiles', {
      select: PROFILE_FIELDS,
      order: 'created_at.desc',
    });
  }

  /** Rol değişikliği (Faz 9c) — `protect_profile_role` trigger'ı admin dışını zaten engeller. */
  updateRole(userId: string, role: ProfileRow['role']): Observable<void> {
    return this.client.update<ProfileRow>('profiles', { id: `eq.${userId}` }, { role });
  }
}
