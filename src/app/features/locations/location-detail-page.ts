import { Component, computed, effect, inject, input, RESPONSE_INIT } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LocationRepository } from '@core/data/location.repository';
import { BusinessRepository } from '@core/data/business.repository';
import { BusinessList } from '@shared/components/business-list';
import { Breadcrumb } from '@shared/components/breadcrumb';
import { Skeleton } from '@shared/ui/skeleton';
import { SeoService } from '@core/seo/seo.service';
import { SchemaService } from '@core/schema/schema.service';
import { buildBreadcrumbList, buildItemList } from '@core/schema/builders';
import { absoluteUrl } from '@env';

/**
 * Bölge detay sayfası — `/bolge/:slug` (§12, §42).
 *
 * İki aşamalı veri akışı: önce lokasyon çözülür, bulunursa (ve yalnızca
 * bulunursa) o lokasyondaki işletmeler için ikinci bir istek başlar.
 * `rxResource`'un `params()` fonksiyonu `undefined` döndüğünde loader hiç
 * çalışmaz — bu yüzden ikinci resource, birinci `location.value()?.id`'ye
 * bağlanarak "önce lokasyon, sonra işletmeler" sırasını doğal olarak korur.
 *
 * Lokasyon bulunamazsa gerçek 404 döner (aynı desen: taxi-detail-page).
 */
@Component({
  selector: 'app-location-detail-page',
  imports: [RouterLink, BusinessList, Skeleton, Breadcrumb],
  template: `
    <div class="container page">
      @if (location.isLoading()) {
        <app-skeleton height="2rem" width="50%" />
      } @else if (location.value(); as loc) {
        <app-breadcrumb [items]="[{ label: 'Bölgeler', path: '/bolge' }, { label: loc.name }]" />

        <h1 class="page-title">{{ loc.name }} Taksileri</h1>
        <p class="lead">{{ loc.name }} bölgesinde hizmet veren taksi işletmeleri.</p>

        <app-business-list
          [businesses]="businesses.value() ?? []"
          [loading]="businesses.isLoading()"
          emptyTitle="Bu bölgede henüz yayınlanmış işletme yok"
          emptyDescription="Doğrulanmamış bilgi yayınlamıyoruz. İşletme sahibiyseniz profilinizi ekleyebilirsiniz."
        >
          <a routerLink="/isletme-ekle" class="btn btn--brand">İşletmemi Yayınla</a>
        </app-business-list>
      } @else {
        <h1 class="page-title">Bölge bulunamadı</h1>
        <p class="lead">
          <code class="slug">{{ slug() }}</code> adresinde tanımlı bir bölge yok.
        </p>
        <a routerLink="/bolge" class="btn btn--secondary">Tüm Bölgeleri Gör</a>
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
export class LocationDetailPage {
  private readonly locationRepo = inject(LocationRepository);
  private readonly businessRepo = inject(BusinessRepository);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });
  private readonly seo = inject(SeoService);
  private readonly schema = inject(SchemaService);

  readonly slug = input.required<string>();

  protected readonly location = rxResource({
    params: () => this.slug(),
    stream: ({ params }) => this.locationRepo.bySlug(params),
  });

  private readonly locationId = computed(() => this.location.value()?.id);

  protected readonly businesses = rxResource({
    params: () => this.locationId(),
    stream: ({ params }) => this.businessRepo.byLocation(params),
  });

  constructor() {
    effect(() => {
      if (this.location.status() !== 'resolved') {
        return;
      }
      const loc = this.location.value();

      if (!loc) {
        if (this.responseInit) {
          this.responseInit.status = 404;
        }
        this.seo.setPage({
          title: 'Bölge bulunamadı — Kütahya Taksi Ağı',
          description: 'Aradığınız bölge bulunamadı.',
          path: `/bolge/${this.slug()}`,
          noindex: true,
        });
        this.schema.remove('breadcrumb');
        this.schema.remove('itemlist');
        return;
      }

      const path = `/bolge/${loc.slug}`;
      this.seo.setPage({
        title: `${loc.name} Taksileri — Kütahya Taksi Ağı`,
        description: `${loc.name} bölgesinde hizmet veren, doğrulanmış taksi işletmeleri.`,
        path,
      });

      this.schema.set(
        'breadcrumb',
        buildBreadcrumbList([{ name: 'Bölgeler', url: absoluteUrl('/bolge') }, { name: loc.name }]),
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
