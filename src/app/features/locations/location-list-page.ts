import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LocationRepository } from '@core/data/location.repository';
import { Skeleton } from '@shared/ui/skeleton';
import { SeoService } from '@core/seo/seo.service';

/**
 * Bölge listesi — `/bolge` (§12, §42).
 *
 * Bu sayfa internal linking omurgasıdır: her ilçe kendi `/bolge/:slug`
 * sayfasına, oradan da o bölgedeki işletmelere bağlanır. İşletme sayısı
 * bağımsız olarak bölgeler her zaman gösterilir — bu bir işletme listesi
 * değil, Kütahya'nın idari coğrafyasının doğru bir temsili (§74: gerçek bilgi).
 */
@Component({
  selector: 'app-location-list-page',
  imports: [RouterLink, Skeleton],
  template: `
    <div class="container page">
      <h1 class="page-title">Kütahya'daki Bölgeler</h1>
      <p class="lead">Kütahya merkez ve ilçelerine göre taksi işletmelerini keşfedin.</p>

      @if (districts.isLoading()) {
        <div class="grid">
          @for (i of [1, 2, 3, 4, 5, 6]; track i) {
            <app-skeleton height="3rem" />
          }
        </div>
      } @else {
        <ul class="grid">
          @for (loc of districts.value() ?? []; track loc.id) {
            <li>
              <a class="card district-link" [routerLink]="['/bolge', loc.slug]">{{ loc.name }}</a>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .page {
      padding-block: var(--sp-8) var(--sp-4);
    }

    .lead {
      margin-block: var(--sp-2) var(--sp-8);
      max-width: 60ch;
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--sp-3);
    }

    .district-link {
      display: block;
      text-align: center;
      text-decoration: none;
      font-weight: var(--fw-medium);
      padding-block: var(--sp-4);
    }

    .district-link:hover {
      border-color: var(--c-border-strong);
    }

    @media (min-width: 640px) {
      .grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (min-width: 1024px) {
      .grid {
        grid-template-columns: repeat(4, 1fr);
      }
    }
  `,
})
export class LocationListPage {
  private readonly repo = inject(LocationRepository);
  private readonly seo = inject(SeoService);

  protected readonly districts = rxResource({
    stream: () => this.repo.districts(),
  });

  constructor() {
    this.seo.setPage({
      title: "Kütahya'daki Bölgeler — Kütahya Taksi Ağı",
      description: 'Kütahya merkez ve ilçelerine göre taksi işletmelerini keşfedin.',
      path: '/bolge',
    });
  }
}
