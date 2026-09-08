import { Component, computed, effect, inject, input, RESPONSE_INIT } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LocationRepository } from '@core/data/location.repository';
import { BusinessRepository } from '@core/data/business.repository';
import { BusinessList } from '@shared/components/business-list';
import { Skeleton } from '@shared/ui/skeleton';

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
  imports: [RouterLink, BusinessList, Skeleton],
  template: `
    <div class="container page">
      @if (location.isLoading()) {
        <app-skeleton height="2rem" width="50%" />
      } @else if (location.value(); as loc) {
        <nav class="breadcrumb muted" aria-label="Ekmek kırıntısı">
          <a routerLink="/bolge">Bölgeler</a> / <span>{{ loc.name }}</span>
        </nav>

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
export class LocationDetailPage {
  private readonly locationRepo = inject(LocationRepository);
  private readonly businessRepo = inject(BusinessRepository);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });
  private readonly title = inject(Title);

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
      if (loc === null && this.responseInit) {
        this.responseInit.status = 404;
      }
      this.title.setTitle(
        loc ? `${loc.name} Taksileri — Kütahya Taksi Ağı` : 'Bölge bulunamadı — Kütahya Taksi Ağı',
      );
    });
  }
}
