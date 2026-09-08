import { Component, computed, effect, inject, input, RESPONSE_INIT } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ServiceRepository } from '@core/data/service.repository';
import { BusinessRepository } from '@core/data/business.repository';
import { BusinessList } from '@shared/components/business-list';
import { Skeleton } from '@shared/ui/skeleton';

/**
 * Hizmet detay sayfası — `/hizmet/:slug` (§10, §42).
 *
 * `location-detail-page.ts` ile aynı iki aşamalı desen: önce hizmet çözülür,
 * bulunursa o hizmeti veren işletmeler için ikinci istek başlar.
 */
@Component({
  selector: 'app-service-detail-page',
  imports: [RouterLink, BusinessList, Skeleton],
  template: `
    <div class="container page">
      @if (service.isLoading()) {
        <app-skeleton height="2rem" width="50%" />
      } @else if (service.value(); as s) {
        <nav class="breadcrumb muted" aria-label="Ekmek kırıntısı">
          <a routerLink="/hizmet">Hizmetler</a> / <span>{{ s.name }}</span>
        </nav>

        <h1 class="page-title">{{ s.name }}</h1>
        @if (s.description) {
          <p class="lead">{{ s.description }}</p>
        }

        <app-business-list
          [businesses]="businesses.value() ?? []"
          [loading]="businesses.isLoading()"
          [emptyTitle]="'Bu hizmeti veren henüz yayınlanmış işletme yok'"
          emptyDescription="Doğrulanmamış bilgi yayınlamıyoruz. İşletme sahibiyseniz profilinizi ekleyebilirsiniz."
        >
          <a routerLink="/isletme-ekle" class="btn btn--brand">İşletmemi Yayınla</a>
        </app-business-list>
      } @else {
        <h1 class="page-title">Hizmet bulunamadı</h1>
        <p class="lead">
          <code class="slug">{{ slug() }}</code> adresinde tanımlı bir hizmet yok.
        </p>
        <a routerLink="/hizmet" class="btn btn--secondary">Tüm Hizmetleri Gör</a>
      }
    </div>
  `,
  styles: `
    .page {
      padding-block: var(--sp-8) var(--sp-12);
    }

    .breadcrumb {
      font-size: var(--fs-sm);
      margin-block-end: var(--sp-3);
    }

    .breadcrumb a {
      text-decoration: none;
    }

    .lead {
      margin-block: var(--sp-2) var(--sp-8);
      max-width: 60ch;
    }

    .slug {
      padding: var(--sp-1) var(--sp-2);
      background-color: var(--c-bg-muted);
      border-radius: var(--radius-sm);
      font-size: var(--fs-sm);
    }
  `,
})
export class ServiceDetailPage {
  private readonly serviceRepo = inject(ServiceRepository);
  private readonly businessRepo = inject(BusinessRepository);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });
  private readonly title = inject(Title);

  readonly slug = input.required<string>();

  protected readonly service = rxResource({
    params: () => this.slug(),
    stream: ({ params }) => this.serviceRepo.bySlug(params),
  });

  private readonly serviceId = computed(() => this.service.value()?.id);

  protected readonly businesses = rxResource({
    params: () => this.serviceId(),
    stream: ({ params }) => this.businessRepo.byService(params),
  });

  constructor() {
    effect(() => {
      if (this.service.status() !== 'resolved') {
        return;
      }
      const s = this.service.value();
      if (s === null && this.responseInit) {
        this.responseInit.status = 404;
      }
      this.title.setTitle(
        s ? `${s.name} — Kütahya Taksi Ağı` : 'Hizmet bulunamadı — Kütahya Taksi Ağı',
      );
    });
  }
}
