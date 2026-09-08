import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BusinessRepository } from '@core/data/business.repository';
import { BusinessList } from '@shared/components/business-list';

/**
 * Taksi listesi — `/taksi` (§23).
 *
 * Veri `rxResource` ile çekilir: SSR sırasında istek tamamlanana kadar render
 * beklenir (Angular'ın pending-task mekanizması), tarayıcıda ise hydration
 * `HttpClient` transfer cache'i sayesinde isteği TEKRARLAMAZ (ARCHITECTURE.md §4).
 *
 * Filtre/sayfalama Faz 4'te (SEO ile birlikte URL query param'ları netleşince)
 * eklenecek — MVP'de tüm aktif işletmeler tek sayfada.
 */
@Component({
  selector: 'app-taxi-list-page',
  imports: [RouterLink, BusinessList],
  template: `
    <div class="container page">
      <h1 class="page-title">Kütahya Taksileri</h1>
      <p class="lead">Kütahya'daki taksi işletmeleri. Her kayıt yayınlanmadan önce doğrulanır.</p>

      <app-business-list
        [businesses]="businesses.value() ?? []"
        [loading]="businesses.isLoading()"
        emptyTitle="Henüz yayınlanmış işletme yok"
        emptyDescription="Doğrulanmamış bilgi yayınlamıyoruz. Kütahya'daki durakların iletişim bilgileri doğrulandıkça burada listelenecek."
      >
        <a routerLink="/isletme-ekle" class="btn btn--brand">İşletmemi Yayınla</a>
      </app-business-list>
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
  `,
})
export class TaxiListPage {
  private readonly repo = inject(BusinessRepository);

  protected readonly businesses = rxResource({
    stream: () => this.repo.list(),
  });
}
