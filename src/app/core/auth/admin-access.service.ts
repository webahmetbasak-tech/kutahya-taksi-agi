import { computed, inject, Injectable } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AuthService } from './auth.service';
import { ProfileRepository } from '@core/data/profile.repository';

/**
 * Oturum açmış kullanıcının admin olup olmadığı (Faz 9).
 *
 * `AuthService`e KARIŞTIRILMADI (tek sorumluluk) — `AuthService` yalnızca
 * oturum durumunu bilir, admin rolü ayrı bir veri sorgusu gerektirir
 * (`profiles.role`, JWT'de yok). `admin.guard.ts` bunu kullanır.
 */
@Injectable({ providedIn: 'root' })
export class AdminAccessService {
  private readonly auth = inject(AuthService);
  private readonly profileRepo = inject(ProfileRepository);

  private readonly userId = computed(() =>
    this.auth.ready() && this.auth.isAuthenticated() ? this.auth.user()?.id : undefined,
  );

  private readonly profile = rxResource({
    params: () => this.userId(),
    stream: ({ params }) => this.profileRepo.mine(params),
  });

  /** Oturum kapalıysa (bekleyecek bir şey yok) ya da profil sorgusu sonuçlandıysa `true`. */
  readonly ready = computed(() => {
    if (!this.auth.ready()) return false;
    if (!this.auth.isAuthenticated()) return true;
    const status = this.profile.status();
    return status === 'resolved' || status === 'error';
  });

  readonly isAdmin = computed(() => this.profile.value()?.role === 'admin');
}
