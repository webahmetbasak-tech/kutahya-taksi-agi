import { Component, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AdminBusinessRepository } from '@core/data/admin-business.repository';
import type { BusinessStatus } from '@core/data/models';
import { SeoService } from '@core/seo/seo.service';
import { Skeleton } from '@shared/ui/skeleton';

const STATUS_TABS: { value: BusinessStatus | undefined; label: string }[] = [
  { value: undefined, label: 'Tümü' },
  { value: 'pending', label: 'İnceleniyor' },
  { value: 'active', label: 'Yayında' },
  { value: 'suspended', label: 'Askıda' },
  { value: 'rejected', label: 'Reddedildi' },
  { value: 'archived', label: 'Kaldırıldı' },
];

const STATUS_LABELS: Record<BusinessStatus, string> = {
  pending: 'İnceleniyor',
  active: 'Yayında',
  suspended: 'Askıda',
  rejected: 'Reddedildi',
  archived: 'Kaldırıldı',
};

const STATUS_BADGE_CLASS: Record<BusinessStatus, string> = {
  pending: 'badge--warning',
  active: 'badge--verified',
  suspended: 'badge--warning',
  rejected: 'badge--danger',
  archived: 'badge--danger',
};

/**
 * `/admin/isletmeler` — tüm işletmeler, durum sekmeleriyle filtrelenebilir
 * (Faz 9a). `durum` query param'ı `withComponentInputBinding()` sayesinde
 * doğrudan `input()`e bağlanır.
 */
@Component({
  selector: 'app-admin-business-list-page',
  imports: [RouterLink, RouterLinkActive, Skeleton],
  template: `
    <h1 class="page-title">İşletmeler</h1>

    <nav class="tabs" aria-label="Duruma göre filtrele">
      @for (tab of tabs; track tab.label) {
        <a
          [routerLink]="['/admin/isletmeler']"
          [queryParams]="{ durum: tab.value }"
          routerLinkActive="is-active"
          [routerLinkActiveOptions]="{ exact: true }"
          class="tabs__link"
        >
          {{ tab.label }}
        </a>
      }
    </nav>

    @if (businesses.isLoading()) {
      <app-skeleton height="4rem" />
      <app-skeleton height="4rem" />
      <app-skeleton height="4rem" />
    } @else if ((businesses.value() ?? []).length === 0) {
      <p class="muted">Bu durumda işletme yok.</p>
    } @else {
      <ul class="business-list">
        @for (b of businesses.value() ?? []; track b.id) {
          <li class="card business-item">
            <a [routerLink]="['/admin/isletmeler', b.id]" class="business-item__link">
              <span class="business-item__name">{{ b.business_name }}</span>
              <span class="badge" [class]="statusBadgeClass(b.status)">{{ statusLabel(b.status) }}</span>
              @if (b.possible_duplicate_of) {
                <span class="badge badge--warning">Olası kopya</span>
              }
            </a>
            <p class="muted business-item__meta">
              {{ b.district || b.neighborhood || 'Bölge yok' }} ·
              {{ b.phone_display || b.phone_e164 || 'Telefon yok' }}
            </p>
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

    .business-list {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }

    .business-item__link {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-2);
      text-decoration: none;
      color: var(--c-text);
    }

    .business-item__name {
      font-weight: var(--fw-semibold);
    }

    .business-item__meta {
      margin-block-start: var(--sp-1);
      font-size: var(--fs-sm);
    }
  `,
})
export class AdminBusinessListPage {
  private readonly repo = inject(AdminBusinessRepository);
  private readonly seo = inject(SeoService);

  readonly durum = input<BusinessStatus | undefined>();
  protected readonly tabs = STATUS_TABS;

  protected readonly businesses = rxResource({
    params: () => this.durum(),
    stream: ({ params }) => this.repo.all(params),
  });

  protected statusLabel(status: BusinessStatus): string {
    return STATUS_LABELS[status];
  }

  protected statusBadgeClass(status: BusinessStatus): string {
    return STATUS_BADGE_CLASS[status];
  }

  constructor() {
    this.seo.setPage({
      title: 'İşletmeler — Yönetim Paneli',
      description: 'Admin paneli.',
      path: '/admin/isletmeler',
      noindex: true,
    });
  }
}
