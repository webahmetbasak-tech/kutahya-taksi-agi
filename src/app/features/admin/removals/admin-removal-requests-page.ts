import { Component, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AdminRemovalRequestRepository } from '@core/data/admin-removal-request.repository';
import type { RemovalRequestStatus } from '@core/data/models';
import { AuthService } from '@core/auth/auth.service';
import { SeoService } from '@core/seo/seo.service';
import { formatTrDate } from '@shared/utils/date';
import { Skeleton } from '@shared/ui/skeleton';

const TABS: { value: RemovalRequestStatus | undefined; label: string }[] = [
  { value: 'pending', label: 'Bekleyenler' },
  { value: undefined, label: 'Tümü' },
  { value: 'completed', label: 'Tamamlananlar' },
  { value: 'dismissed', label: 'Reddedilenler' },
];

/** `/admin/kaldirma-talepleri` — KVKK kaldırma talebi kuyruğu (Faz 9c, §56). */
@Component({
  selector: 'app-admin-removal-requests-page',
  imports: [RouterLink, RouterLinkActive, Skeleton],
  template: `
    <h1 class="page-title">Kaldırma Talepleri</h1>

    <nav class="tabs" aria-label="Duruma göre filtrele">
      @for (tab of tabs; track tab.label) {
        <a
          [routerLink]="['/admin/kaldirma-talepleri']"
          [queryParams]="{ durum: tab.value }"
          routerLinkActive="is-active"
          [routerLinkActiveOptions]="{ exact: true }"
          class="tabs__link"
        >
          {{ tab.label }}
        </a>
      }
    </nav>

    @if (actionError(); as err) {
      <p class="form-banner form-banner--error" role="alert">{{ err }}</p>
    }

    @if (requests.isLoading()) {
      <app-skeleton height="5rem" />
      <app-skeleton height="5rem" />
    } @else if ((requests.value() ?? []).length === 0) {
      <p class="muted">Bu durumda talep yok.</p>
    } @else {
      <ul class="removal-list">
        @for (r of requests.value() ?? []; track r.id) {
          <li class="card removal-item">
            <div class="removal-item__header">
              <a [routerLink]="['/admin/isletmeler', r.business_id]">
                {{ r.business?.business_name ?? 'Bilinmeyen işletme' }}
              </a>
              <span class="muted">{{ formatTrDate(r.created_at) }}</span>
            </div>
            <p>{{ r.reason }}</p>
            @if (r.contact_email) {
              <p class="muted">İletişim: {{ r.contact_email }}</p>
            }
            @if (r.status === 'pending') {
              <div class="actions">
                <button type="button" class="btn btn--brand" (click)="resolve(r.id, 'completed')">
                  Tamamlandı (kaldırıldı)
                </button>
                <button type="button" class="btn btn--secondary" (click)="resolve(r.id, 'dismissed')">
                  Reddet
                </button>
              </div>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-2);
      margin-block-end: var(--sp-5);
    }

    .tabs__link {
      display: inline-flex;
      align-items: center;
      min-height: var(--tap-min);
      padding-inline: var(--sp-3);
      border-radius: var(--radius-full);
      border: 1px solid var(--c-border);
      text-decoration: none;
      font-size: var(--fs-sm);
      color: var(--c-text-muted);
    }

    .tabs__link.is-active {
      color: var(--c-action-strong);
      background-color: var(--c-action-soft);
      border-color: transparent;
    }

    .removal-list {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }

    .removal-item__header {
      display: flex;
      justify-content: space-between;
      gap: var(--sp-3);
      font-size: var(--fs-sm);
    }

    .removal-item p + p {
      margin-block-start: var(--sp-1);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-3);
      margin-block-start: var(--sp-3);
    }
  `,
})
export class AdminRemovalRequestsPage {
  private readonly repo = inject(AdminRemovalRequestRepository);
  private readonly auth = inject(AuthService);
  private readonly seo = inject(SeoService);

  readonly durum = input<RemovalRequestStatus | undefined>('pending');
  protected readonly tabs = TABS;
  protected readonly actionError = signal<string | null>(null);
  protected readonly formatTrDate = formatTrDate;

  protected readonly requests = rxResource({
    params: () => this.durum(),
    stream: ({ params }) => this.repo.all(params),
  });

  protected resolve(id: string, status: 'completed' | 'dismissed'): void {
    const adminId = this.auth.user()?.id;
    if (!adminId) return;

    this.actionError.set(null);
    this.repo.resolve(id, status, adminId).subscribe({
      next: () => this.requests.reload(),
      error: () => this.actionError.set('Güncellenemedi. Lütfen tekrar deneyin.'),
    });
  }

  constructor() {
    this.seo.setPage({
      title: 'Kaldırma Talepleri — Yönetim Paneli',
      description: 'Admin paneli.',
      path: '/admin/kaldirma-talepleri',
      noindex: true,
    });
  }
}
