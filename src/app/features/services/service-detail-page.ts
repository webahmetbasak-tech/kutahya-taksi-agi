import { Component, computed, effect, inject, input, RESPONSE_INIT } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ServiceRepository } from '@core/data/service.repository';
import { BusinessRepository } from '@core/data/business.repository';
import { BusinessList } from '@shared/components/business-list';
import { Breadcrumb } from '@shared/components/breadcrumb';
import { Skeleton } from '@shared/ui/skeleton';
import { SeoService } from '@core/seo/seo.service';
import { SchemaService } from '@core/schema/schema.service';
import { buildBreadcrumbList, buildItemList } from '@core/schema/builders';
import { absoluteUrl } from '@env';

/**
 * Hizmet detay sayfası — `/hizmet/:slug` (§10, §42).
 *
 * `location-detail-page.ts` ile aynı iki aşamalı desen: önce hizmet çözülür,
 * bulunursa o hizmeti veren işletmeler için ikinci istek başlar.
 */
@Component({
  selector: 'app-service-detail-page',
  imports: [RouterLink, BusinessList, Skeleton, Breadcrumb],
  template: `
    <div class="container page">
      @if (service.isLoading()) {
        <app-skeleton height="2rem" width="50%" />
      } @else if (service.value(); as s) {
        <app-breadcrumb [items]="[{ label: 'Hizmetler', path: '/hizmet' }, { label: s.name }]" />

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
  private readonly seo = inject(SeoService);
  private readonly schema = inject(SchemaService);

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

      if (!s) {
        if (this.responseInit) {
          this.responseInit.status = 404;
        }
        this.seo.setPage({
          title: 'Hizmet bulunamadı — Kütahya Taksi Ağı',
          description: 'Aradığınız hizmet bulunamadı.',
          path: `/hizmet/${this.slug()}`,
          noindex: true,
        });
        this.schema.remove('breadcrumb');
        this.schema.remove('itemlist');
        return;
      }

      const path = `/hizmet/${s.slug}`;
      this.seo.setPage({
        title: `${s.name} — Kütahya Taksi Ağı`,
        description: s.description ?? `${s.name} hizmeti veren Kütahya taksi işletmeleri.`,
        path,
      });

      this.schema.set(
        'breadcrumb',
        buildBreadcrumbList([{ name: 'Hizmetler', url: absoluteUrl('/hizmet') }, { name: s.name }]),
      );

      const list = this.businesses.value();
      if (list && list.length > 0) {
        this.schema.set(
          'itemlist',
          buildItemList(
            list.map((b) => ({ name: b.business_name, url: absoluteUrl(`/taksi/${b.slug}`) })),
          ),
        );
      } else {
        this.schema.remove('itemlist');
      }
    });
  }
}
