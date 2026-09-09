import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AdminBusinessRepository } from '@core/data/admin-business.repository';
import { AnalyticsRepository } from '@core/data/analytics.repository';
import { SeoService } from '@core/seo/seo.service';
import { summarizeDailyStats } from '@shared/utils/analytics-stats';
import { Skeleton } from '@shared/ui/skeleton';

/**
 * `/admin/analitik` — herhangi bir işletmenin istatistiklerini görüntüleme
 * (Faz 9b). Yeni bir sorgu YOK — `AnalyticsRepository.dailyStats()` (Faz 6)
 * zaten `analytics_daily_select_own` RLS'i sayesinde admin için TÜM
 * işletmeleri döndürüyor; burada yalnızca bir işletme seçici eklendi.
 */
@Component({
  selector: 'app-admin-analytics-page',
  imports: [Skeleton],
  template: `
    <h1 class="page-title">Analitik</h1>

    @if (businesses.isLoading()) {
      <app-skeleton height="2.5rem" width="20rem" />
    } @else {
      <div class="field picker">
        <label class="field__label" for="biz-picker">İşletme</label>
        <select
          id="biz-picker"
          class="field__input"
          [value]="selectedId() ?? ''"
          (change)="selectedId.set($any($event.target).value || null)"
        >
          <option value="">Seçin…</option>
          @for (b of businesses.value() ?? []; track b.id) {
            <option [value]="b.id">{{ b.business_name }}</option>
          }
        </select>
      </div>
    }

    @if (selectedId()) {
      @if (stats.isLoading()) {
        <app-skeleton height="6rem" />
      } @else {
        <dl class="stats">
          <div class="stats__item">
            <dt>Profil görüntülenme</dt>
            <dd>{{ summary().profileViews }}</dd>
          </div>
          <div class="stats__item">
            <dt>Arama tıklaması</dt>
            <dd>{{ summary().callClicks }}</dd>
          </div>
          <div class="stats__item">
            <dt>WhatsApp tıklaması</dt>
            <dd>{{ summary().whatsappClicks }}</dd>
          </div>
          <div class="stats__item">
            <dt>Yol tarifi tıklaması</dt>
            <dd>{{ summary().directionsClicks }}</dd>
          </div>
        </dl>
        <p class="muted">Son 30 gün</p>
      }
    }
  `,
  styles: `
    .picker {
      max-width: 24rem;
      margin-block-end: var(--sp-6);
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      gap: var(--sp-4);
    }

    .stats__item dt {
      font-size: var(--fs-xs);
      color: var(--c-text-muted);
    }

    .stats__item dd {
      font-size: var(--fs-2xl);
      font-weight: var(--fw-semibold);
    }
  `,
})
export class AdminAnalyticsPage {
  private readonly businessRepo = inject(AdminBusinessRepository);
  private readonly analyticsRepo = inject(AnalyticsRepository);
  private readonly seo = inject(SeoService);

  protected readonly businesses = rxResource({ stream: () => this.businessRepo.all() });
  protected readonly selectedId = signal<string | null>(null);

  protected readonly stats = rxResource({
    params: () => this.selectedId() ?? undefined,
    stream: ({ params }) => this.analyticsRepo.dailyStats(params),
  });

  protected readonly summary = computed(() => summarizeDailyStats(this.stats.value() ?? []));

  constructor() {
    this.seo.setPage({
      title: 'Analitik — Yönetim Paneli',
      description: 'Admin paneli.',
      path: '/admin/analitik',
      noindex: true,
    });
  }
}
