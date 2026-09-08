import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ServiceRepository } from '@core/data/service.repository';
import { Skeleton } from '@shared/ui/skeleton';
import { SeoService } from '@core/seo/seo.service';

/**
 * Hizmet listesi — `/hizmet` (§10, §42).
 *
 * Hizmet açıklamaları `services` tablosundaki gerçek taksonomi metinleridir
 * (§74 uyarınca uydurulmuş SEO metni değil) — Faz 2'de referans veri olarak
 * migration'a yazıldı.
 */
@Component({
  selector: 'app-service-list-page',
  imports: [RouterLink, Skeleton],
  template: `
    <div class="container page">
      <h1 class="page-title">Hizmetler</h1>
      <p class="lead">Kütahya'daki taksi işletmelerinin sunduğu hizmet türleri.</p>

      @if (services.isLoading()) {
        <div class="grid">
          @for (i of [1, 2, 3, 4]; track i) {
            <app-skeleton height="5rem" />
          }
        </div>
      } @else {
        <ul class="grid">
          @for (s of services.value() ?? []; track s.id) {
            <li>
              <a class="card service-link" [routerLink]="['/hizmet', s.slug]">
                <span class="service-link__name">{{ s.name }}</span>
                @if (s.description) {
                  <span class="service-link__desc muted">{{ s.description }}</span>
                }
              </a>
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

    .service-link {
      display: flex;
      flex-direction: column;
      gap: var(--sp-1);
      text-decoration: none;
    }

    .service-link__name {
      font-weight: var(--fw-semibold);
    }

    .service-link__desc {
      font-size: var(--fs-sm);
    }

    @media (min-width: 640px) {
      .grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (min-width: 1024px) {
      .grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }
  `,
})
export class ServiceListPage {
  private readonly repo = inject(ServiceRepository);
  private readonly seo = inject(SeoService);

  protected readonly services = rxResource({
    stream: () => this.repo.list(),
  });

  constructor() {
    this.seo.setPage({
      title: 'Hizmetler — Kütahya Taksi Ağı',
      description: "Kütahya'daki taksi işletmelerinin sunduğu hizmet türleri.",
      path: '/hizmet',
    });
  }
}
