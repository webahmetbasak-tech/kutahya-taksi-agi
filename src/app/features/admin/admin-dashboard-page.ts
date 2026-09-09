import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminBusinessRepository } from '@core/data/admin-business.repository';
import { AdminClaimRepository } from '@core/data/admin-claim.repository';
import { AdminReviewRepository } from '@core/data/admin-review.repository';
import { AdminRemovalRequestRepository } from '@core/data/admin-removal-request.repository';
import { SeoService } from '@core/seo/seo.service';
import { Skeleton } from '@shared/ui/skeleton';

/**
 * `/admin` özet ekranı — "dikkat gerektiren" sayımlar (Faz 9a).
 *
 * Yalnızca sayım/link gösterir; işlemler kendi ekranlarında (`/admin/isletmeler`,
 * `/admin/talepler`).
 */
@Component({
  selector: 'app-admin-dashboard-page',
  imports: [RouterLink, Skeleton],
  template: `
    <h1 class="page-title">Yönetim Özeti</h1>

    <div class="cards">
      <a routerLink="/admin/isletmeler" [queryParams]="{ durum: 'pending' }" class="card stat-card">
        <span class="stat-card__label">İncelemedeki İşletmeler</span>
        @if (pendingBusinesses.isLoading()) {
          <app-skeleton height="2rem" width="3rem" />
        } @else {
          <span class="stat-card__value">{{ pendingBusinesses.value() ?? 0 }}</span>
        }
      </a>

      <a routerLink="/admin/talepler" class="card stat-card">
        <span class="stat-card__label">Bekleyen Sahiplenme Talepleri</span>
        @if (pendingClaims.isLoading()) {
          <app-skeleton height="2rem" width="3rem" />
        } @else {
          <span class="stat-card__value">{{ pendingClaims.value() ?? 0 }}</span>
        }
      </a>

      <a
        routerLink="/admin/degerlendirmeler"
        [queryParams]="{ durum: 'pending' }"
        class="card stat-card"
      >
        <span class="stat-card__label">Bekleyen Değerlendirmeler</span>
        @if (pendingReviews.isLoading()) {
          <app-skeleton height="2rem" width="3rem" />
        } @else {
          <span class="stat-card__value">{{ pendingReviews.value() ?? 0 }}</span>
        }
      </a>

      <a
        routerLink="/admin/kaldirma-talepleri"
        [queryParams]="{ durum: 'pending' }"
        class="card stat-card"
      >
        <span class="stat-card__label">Bekleyen Kaldırma Talepleri</span>
        @if (pendingRemovals.isLoading()) {
          <app-skeleton height="2rem" width="3rem" />
        } @else {
          <span class="stat-card__value">{{ pendingRemovals.value() ?? 0 }}</span>
        }
      </a>
    </div>
  `,
  styles: `
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      gap: var(--sp-4);
    }

    .stat-card {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
      text-decoration: none;
      color: var(--c-text);
    }

    .stat-card:hover {
      border-color: var(--c-border-strong);
    }

    .stat-card__label {
      font-size: var(--fs-sm);
      color: var(--c-text-muted);
    }

    .stat-card__value {
      font-size: var(--fs-3xl);
      font-weight: var(--fw-bold);
    }
  `,
})
export class AdminDashboardPage {
  private readonly businessRepo = inject(AdminBusinessRepository);
  private readonly claimRepo = inject(AdminClaimRepository);
  private readonly reviewRepo = inject(AdminReviewRepository);
  private readonly removalRepo = inject(AdminRemovalRequestRepository);
  private readonly seo = inject(SeoService);

  protected readonly pendingBusinesses = rxResource({
    stream: () => this.businessRepo.countPending(),
  });

  protected readonly pendingClaims = rxResource({
    stream: () => this.claimRepo.countPending(),
  });

  protected readonly pendingReviews = rxResource({
    stream: () => this.reviewRepo.countPending(),
  });

  protected readonly pendingRemovals = rxResource({
    stream: () => this.removalRepo.countPending(),
  });

  constructor() {
    this.seo.setPage({
      title: 'Yönetim Paneli — Kütahya Taksi Ağı',
      description: 'Admin paneli.',
      path: '/admin',
      noindex: true,
    });
  }
}
