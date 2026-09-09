import { Component, computed, effect, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { forkJoin, map } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import { Spinner } from '@shared/ui/spinner';
import { Skeleton } from '@shared/ui/skeleton';
import { SeoService } from '@core/seo/seo.service';
import { AuthService } from '@core/auth/auth.service';
import { AdminAccessService } from '@core/auth/admin-access.service';
import { BusinessRepository } from '@core/data/business.repository';
import { ClaimRepository } from '@core/data/claim.repository';
import { AnalyticsRepository } from '@core/data/analytics.repository';
import type { BusinessStatus, ClaimRow, OwnedBusinessRow } from '@core/data/models';
import { summarizeDailyStats, type BusinessStats } from '@shared/utils/analytics-stats';

const BUSINESS_STATUS_LABELS: Record<BusinessStatus, string> = {
  pending: 'İnceleniyor',
  active: 'Yayında',
  suspended: 'Askıya alındı',
  rejected: 'Reddedildi',
  archived: 'Kaldırıldı',
};

const BUSINESS_STATUS_BADGE_CLASS: Record<BusinessStatus, string> = {
  pending: 'badge--warning',
  active: 'badge--verified',
  suspended: 'badge--warning',
  rejected: 'badge--danger',
  archived: 'badge--danger',
};

const CLAIM_STATUS_LABELS: Record<ClaimRow['status'], string> = {
  pending: 'İnceleniyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  cancelled: 'İptal edildi',
};

const CLAIM_STATUS_BADGE_CLASS: Record<ClaimRow['status'], string> = {
  pending: 'badge--warning',
  approved: 'badge--verified',
  rejected: 'badge--danger',
  cancelled: 'badge--danger',
};


/**
 * İşletme sahibi paneli — `/panel` (§27, Faz 7).
 *
 * `RenderMode.Client` ile çalışır: SEO'ya konu olmadığı için sunucuda render
 * edilmez, lazy chunk olarak yalnızca giriş yapmış kullanıcıya iner.
 *
 * `isPlatformBrowser` kontrolü aynı zamanda Client render modunun gerçekten
 * çalıştığının kanıtıdır — sunucu HTML'inde bu sayfanın içeriği bulunmaz.
 *
 * Oturum yoksa `/giris?redirect=/panel`e yönlendirir. Görüntülenen tüm veri
 * (işletmeler, talepler, günlük istatistikler) RLS'e güvenir — `owner_id=eq.`
 * filtreleri yalnızca görünürlüğü DARALTIR, güvenliği SAĞLAMAZ (§54).
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, Spinner, Skeleton],
  template: `
    <div class="container page">
      @if (!isBrowser()) {
        <app-spinner label="Panel yükleniyor" />
      } @else if (!auth.ready() || (auth.isAuthenticated() && (businesses.isLoading() || claims.isLoading()))) {
        <app-skeleton height="2rem" width="50%" />
        <div class="skeleton-block">
          <app-skeleton height="6rem" />
          <app-skeleton height="6rem" />
        </div>
      } @else if (!auth.isAuthenticated()) {
        <p class="lead">Giriş sayfasına yönlendiriliyorsunuz…</p>
      } @else {
        <h1 class="page-title">İşletme Paneli</h1>

        @if (adminAccess.isAdmin()) {
          <a routerLink="/admin" class="btn btn--secondary admin-link">Yönetim Paneline Git</a>
        }

        @if ((businesses.value() ?? []).length === 0) {
          <div class="card notice">
            <p><strong>Henüz sahiplendiğiniz bir işletme yok.</strong></p>
            <p class="muted">
              Taksi işletmenizi bulup "Bu işletme size mi ait?" bağlantısından sahiplenebilir, ya da
              hiç listede yoksa ücretsiz ekleyebilirsiniz.
            </p>
            <a routerLink="/isletme-ekle" class="btn btn--brand">İşletmemi Yayınla</a>
          </div>
        } @else {
          <section class="section" aria-labelledby="businesses-heading">
            <h2 id="businesses-heading" class="section-title">İşletmelerim</h2>
            <ul class="business-list">
              @for (b of businesses.value() ?? []; track b.id) {
                <li class="card business-item">
                  <div class="business-item__header">
                    <a class="business-item__name" [routerLink]="['/taksi', b.slug]">{{
                      b.business_name
                    }}</a>
                    <span class="badge" [class]="statusBadgeClass(b.status)">{{
                      statusLabel(b.status)
                    }}</span>
                  </div>
                  @if (statsFor(b.id); as stats) {
                    <dl class="stats">
                      <div class="stats__item">
                        <dt>Profil görüntülenme</dt>
                        <dd>{{ stats.profileViews }}</dd>
                      </div>
                      <div class="stats__item">
                        <dt>Arama tıklaması</dt>
                        <dd>{{ stats.callClicks }}</dd>
                      </div>
                      <div class="stats__item">
                        <dt>WhatsApp tıklaması</dt>
                        <dd>{{ stats.whatsappClicks }}</dd>
                      </div>
                      <div class="stats__item">
                        <dt>Yol tarifi tıklaması</dt>
                        <dd>{{ stats.directionsClicks }}</dd>
                      </div>
                    </dl>
                    <p class="muted stats__note">Son 30 gün</p>
                  }
                </li>
              }
            </ul>
          </section>
        }

        @if ((claims.value() ?? []).length > 0) {
          <section class="section" aria-labelledby="claims-heading">
            <h2 id="claims-heading" class="section-title">Sahiplenme Taleplerim</h2>
            <ul class="claim-list">
              @for (c of claims.value() ?? []; track c.id) {
                <li class="card claim-item">
                  <span class="badge" [class]="claimBadgeClass(c.status)">{{
                    claimStatusLabel(c.status)
                  }}</span>
                  @if (c.reviewer_note) {
                    <p class="muted claim-item__note">{{ c.reviewer_note }}</p>
                  }
                </li>
              }
            </ul>
          </section>
        }
      }
    </div>
  `,
  styles: `
    .page {
      padding-block: var(--sp-8) var(--sp-12);
      max-width: 46rem;
    }

    .admin-link {
      display: inline-flex;
      margin-block: var(--sp-3) var(--sp-6);
    }

    .notice p + p {
      margin-block-start: var(--sp-2);
    }

    .notice .btn {
      margin-block-start: var(--sp-4);
    }

    .skeleton-block {
      margin-block-start: var(--sp-4);
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }

    .section {
      padding-block-start: var(--sp-8);
    }

    .section:first-of-type {
      padding-block-start: var(--sp-6);
    }

    .section-title {
      margin-block-end: var(--sp-4);
    }

    .business-list,
    .claim-list {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }

    .business-item__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-3);
    }

    .business-item__name {
      font-weight: var(--fw-semibold);
      text-decoration: none;
    }

    .business-item__name:hover {
      text-decoration: underline;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--sp-3);
      margin-block-start: var(--sp-4);
    }

    .stats__item dt {
      font-size: var(--fs-xs);
      color: var(--c-text-muted);
    }

    .stats__item dd {
      font-size: var(--fs-lg);
      font-weight: var(--fw-semibold);
    }

    .stats__note {
      font-size: var(--fs-xs);
      margin-block-start: var(--sp-2);
    }

    .claim-item__note {
      margin-block-start: var(--sp-2);
      font-size: var(--fs-sm);
    }
  `,
})
export class DashboardPage {
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  protected readonly auth = inject(AuthService);
  protected readonly adminAccess = inject(AdminAccessService);
  private readonly businessRepo = inject(BusinessRepository);
  private readonly claimRepo = inject(ClaimRepository);
  private readonly analyticsRepo = inject(AnalyticsRepository);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  private readonly userId = computed(() =>
    this.auth.ready() && this.auth.isAuthenticated() ? this.auth.user()?.id : undefined,
  );

  protected readonly businesses = rxResource({
    params: () => this.userId(),
    stream: ({ params }) => this.businessRepo.mine(params),
  });

  protected readonly claims = rxResource({
    params: () => this.userId(),
    stream: ({ params }) => this.claimRepo.mine(params),
  });

  private readonly businessIds = computed(
    () => (this.businesses.value() ?? []).map((b: OwnedBusinessRow) => b.id),
  );

  private readonly stats = rxResource({
    params: () => (this.businessIds().length > 0 ? this.businessIds() : undefined),
    stream: ({ params }) =>
      forkJoin(
        params.map((id) =>
          this.analyticsRepo.dailyStats(id).pipe(map((rows) => [id, summarizeDailyStats(rows)] as const)),
        ),
      ).pipe(map((entries) => new Map(entries))),
  });

  protected statsFor(businessId: string): BusinessStats | undefined {
    return this.stats.value()?.get(businessId);
  }

  protected statusLabel(status: BusinessStatus): string {
    return BUSINESS_STATUS_LABELS[status];
  }

  protected statusBadgeClass(status: BusinessStatus): string {
    return BUSINESS_STATUS_BADGE_CLASS[status];
  }

  protected claimStatusLabel(status: ClaimRow['status']): string {
    return CLAIM_STATUS_LABELS[status];
  }

  protected claimBadgeClass(status: ClaimRow['status']): string {
    return CLAIM_STATUS_BADGE_CLASS[status];
  }

  constructor() {
    // Kimlik doğrulama arkasındaki özel bir alan — her koşulda noindex (§54).
    this.seo.setPage({
      title: 'İşletme Paneli — Kütahya Taksi Ağı',
      description: 'İşletme sahibi paneli.',
      path: '/panel',
      noindex: true,
    });

    effect(() => {
      if (this.isBrowser() && this.auth.ready() && !this.auth.isAuthenticated()) {
        void this.router.navigate(['/giris'], { queryParams: { redirect: '/panel' } });
      }
    });
  }
}
