import { Component, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AdminReviewRepository } from '@core/data/admin-review.repository';
import type { ReviewStatus } from '@core/data/models';
import { SeoService } from '@core/seo/seo.service';
import { formatTrDate } from '@shared/utils/date';
import { Skeleton } from '@shared/ui/skeleton';

const TABS: { value: ReviewStatus | undefined; label: string }[] = [
  { value: 'pending', label: 'Bekleyenler' },
  { value: undefined, label: 'Tümü' },
  { value: 'approved', label: 'Onaylananlar' },
  { value: 'rejected', label: 'Reddedilenler' },
];

/** `/admin/degerlendirmeler` — review moderasyonu (Faz 9b, V1'de yalnızca admin onaylı yazma). */
@Component({
  selector: 'app-admin-reviews-page',
  imports: [RouterLink, RouterLinkActive, Skeleton],
  template: `
    <h1 class="page-title">Değerlendirmeler</h1>

    <nav class="tabs" aria-label="Duruma göre filtrele">
      @for (tab of tabs; track tab.label) {
        <a
          [routerLink]="['/admin/degerlendirmeler']"
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

    @if (reviews.isLoading()) {
      <app-skeleton height="5rem" />
      <app-skeleton height="5rem" />
    } @else if ((reviews.value() ?? []).length === 0) {
      <p class="muted">Bu durumda değerlendirme yok.</p>
    } @else {
      <ul class="review-list">
        @for (r of reviews.value() ?? []; track r.id) {
          <li class="card review-item">
            <div class="review-item__header">
              <span>{{ r.business?.business_name ?? 'Bilinmeyen işletme' }}</span>
              <span class="muted">{{ formatTrDate(r.created_at) }}</span>
            </div>
            <p>{{ '★'.repeat(r.rating) }}{{ '☆'.repeat(5 - r.rating) }}</p>
            @if (r.review_text) {
              <p>{{ r.review_text }}</p>
            }
            @if (r.status === 'pending') {
              <div class="actions">
                <button type="button" class="btn btn--brand" (click)="moderate(r.id, 'approved')">
                  Onayla
                </button>
                <button type="button" class="btn btn--secondary" (click)="moderate(r.id, 'rejected')">
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

    .review-list {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }

    .review-item__header {
      display: flex;
      justify-content: space-between;
      gap: var(--sp-3);
      font-size: var(--fs-sm);
    }

    .review-item p + p {
      margin-block-start: var(--sp-2);
    }

    .actions {
      display: flex;
      gap: var(--sp-3);
      margin-block-start: var(--sp-3);
    }
  `,
})
export class AdminReviewsPage {
  private readonly repo = inject(AdminReviewRepository);
  private readonly seo = inject(SeoService);

  readonly durum = input<ReviewStatus | undefined>('pending');
  protected readonly tabs = TABS;
  protected readonly actionError = signal<string | null>(null);
  protected readonly formatTrDate = formatTrDate;

  // Bkz. AdminClaimsPage'deki aynı yorum — "Tümü" sekmesi `durum`u `undefined`
  // yaptığında bare `params()` resource'u sonsuza kadar "hazır değil" bırakırdı.
  protected readonly reviews = rxResource({
    params: () => ({ status: this.durum() }),
    stream: ({ params }) => this.repo.all(params.status),
  });

  protected moderate(id: string, status: ReviewStatus): void {
    this.actionError.set(null);
    this.repo.moderate(id, status).subscribe({
      next: () => this.reviews.reload(),
      error: () => this.actionError.set('Güncellenemedi. Lütfen tekrar deneyin.'),
    });
  }

  constructor() {
    this.seo.setPage({
      title: 'Değerlendirmeler — Yönetim Paneli',
      description: 'Admin paneli.',
      path: '/admin/degerlendirmeler',
      noindex: true,
    });
  }
}
