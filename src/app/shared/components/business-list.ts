import { Component, input } from '@angular/core';
import { TaxiCard } from './taxi-card';
import { Skeleton } from '@shared/ui/skeleton';
import { EmptyState } from '@shared/ui/empty-state';
import type { BusinessCard } from '@core/data/models';

/**
 * Yükleniyor / dolu / boş üç durumunu tutarlı şekilde gösteren işletme grid'i.
 *
 * Bu bileşen dört sayfada (ana sayfa, /taksi, /bolge/:slug, /hizmet/:slug)
 * tekrarlanan "yükleniyor mu, sonuç var mı, yoksa boş mu" mantığını tek yere
 * topluyor — aynı üç durumu dört kez yazmak yerine.
 */
@Component({
  selector: 'app-business-list',
  imports: [TaxiCard, Skeleton, EmptyState],
  template: `
    @if (loading()) {
      <div class="business-list__grid">
        @for (i of skeletonRows; track i) {
          <div class="card business-list__skeleton-card">
            <app-skeleton height="1.25rem" width="65%" />
            <app-skeleton height="0.875rem" width="40%" />
            <app-skeleton height="2.75rem" />
          </div>
        }
      </div>
    } @else if (businesses().length > 0) {
      <div class="business-list__grid">
        @for (b of businesses(); track b.id) {
          <app-taxi-card [business]="b" />
        }
      </div>
    } @else {
      <app-empty-state [title]="emptyTitle()" [description]="emptyDescription()">
        <ng-content />
      </app-empty-state>
    }
  `,
  styles: `
    .business-list__grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--sp-4);
    }

    .business-list__skeleton-card {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }

    @media (min-width: 640px) {
      .business-list__grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (min-width: 1024px) {
      .business-list__grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }
  `,
})
export class BusinessList {
  readonly businesses = input.required<BusinessCard[]>();
  readonly loading = input(false);
  readonly emptyTitle = input('Henüz yayınlanmış işletme yok');
  readonly emptyDescription = input<string>();

  protected readonly skeletonRows = [1, 2, 3];
}
