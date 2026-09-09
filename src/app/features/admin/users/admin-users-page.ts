import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ProfileRepository } from '@core/data/profile.repository';
import type { UserRole } from '@core/data/models';
import { SeoService } from '@core/seo/seo.service';
import { formatTrDate } from '@shared/utils/date';
import { Skeleton } from '@shared/ui/skeleton';

const ROLES: UserRole[] = ['customer', 'business_owner', 'admin'];

const ROLE_LABELS: Record<UserRole, string> = {
  customer: 'Müşteri',
  business_owner: 'İşletme Sahibi',
  admin: 'Admin',
};

/**
 * `/admin/kullanicilar` — kullanıcı listesi + rol değişimi (Faz 9c).
 *
 * BİLİNÇLİ SINIRLAMA: e-posta ile arama YOK — e-posta `auth.users`
 * şemasında, PostgREST bunu dışa açmıyor; bunu göstermek yeni bir
 * `SUPABASE_SERVICE_ROLE_KEY` kullanan ayrıcalıklı sunucu endpoint'i
 * gerektirirdi (bilinçli olarak ertelendi). Liste ad/telefon/rol/kayıt
 * tarihine göre çalışır.
 */
@Component({
  selector: 'app-admin-users-page',
  imports: [Skeleton],
  template: `
    <h1 class="page-title">Kullanıcılar</h1>
    <p class="muted note">
      E-posta ile arama şu an desteklenmiyor — kullanıcılar ad/telefon/rolüne göre listelenir.
    </p>

    @if (errorMessage(); as err) {
      <p class="form-banner form-banner--error" role="alert">{{ err }}</p>
    }

    @if (profiles.isLoading()) {
      <app-skeleton height="3rem" />
      <app-skeleton height="3rem" />
    } @else {
      <ul class="user-list">
        @for (p of profiles.value() ?? []; track p.id) {
          <li class="card user-item">
            <div class="user-item__row">
              <span>
                <strong>{{ p.full_name || 'İsimsiz kullanıcı' }}</strong>
                @if (p.phone_e164) {
                  <span class="muted"> — {{ p.phone_e164 }}</span>
                }
              </span>
              <span class="muted">{{ formatTrDate(p.created_at) }}</span>
            </div>
            <div class="field role-field">
              <label class="visually-hidden" [attr.for]="'role-' + p.id">Rol</label>
              <select
                [id]="'role-' + p.id"
                class="field__input"
                [value]="p.role"
                (change)="changeRole(p.id, $any($event.target).value)"
              >
                @for (r of roles; track r) {
                  <option [value]="r">{{ roleLabel(r) }}</option>
                }
              </select>
            </div>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .note {
      margin-block: var(--sp-2) var(--sp-6);
    }

    .user-list {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }

    .user-item__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-3);
    }

    .role-field {
      margin-block-start: var(--sp-3);
      max-width: 14rem;
    }
  `,
})
export class AdminUsersPage {
  private readonly repo = inject(ProfileRepository);
  private readonly seo = inject(SeoService);

  protected readonly profiles = rxResource({ stream: () => this.repo.all() });
  protected readonly roles = ROLES;
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly formatTrDate = formatTrDate;

  protected roleLabel(role: UserRole): string {
    return ROLE_LABELS[role];
  }

  protected changeRole(userId: string, role: UserRole): void {
    this.errorMessage.set(null);
    this.repo.updateRole(userId, role).subscribe({
      next: () => this.profiles.reload(),
      error: () => this.errorMessage.set('Rol güncellenemedi. Lütfen tekrar deneyin.'),
    });
  }

  constructor() {
    this.seo.setPage({
      title: 'Kullanıcılar — Yönetim Paneli',
      description: 'Admin paneli.',
      path: '/admin/kullanicilar',
      noindex: true,
    });
  }
}
