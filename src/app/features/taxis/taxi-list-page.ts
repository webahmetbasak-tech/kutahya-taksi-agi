import { Component, effect, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BusinessRepository } from '@core/data/business.repository';
import { BusinessList } from '@shared/components/business-list';
import { SeoService } from '@core/seo/seo.service';
import { SchemaService } from '@core/schema/schema.service';
import { buildItemList } from '@core/schema/builders';
import { absoluteUrl } from '@env';

/**
 * Taksi listesi — `/taksi` (§23). Bu sayfanın canonical'ı KENDİSİDİR
 * (ARCHITECTURE.md §8) — `/kutahya-taksi` gibi SEO landing page'leri (§30)
 * ayrı, kendi içeriğine sahip sayfalardır, buraya yönlendirilmez.
 *
 * Veri `rxResource` ile çekilir: SSR sırasında istek tamamlanana kadar render
 * beklenir (Angular'ın pending-task mekanizması), tarayıcıda ise hydration
 * elle uygulanan TransferState sayesinde isteği TEKRARLAMAZ (ARCHITECTURE.md §4).
 *
 * Filtre/sayfalama ileride (URL query param'ları netleşince) eklenecek —
 * MVP'de tüm aktif işletmeler tek sayfada.
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
  private readonly seo = inject(SeoService);
  private readonly schema = inject(SchemaService);

  protected readonly businesses = rxResource({
    stream: () => this.repo.list(),
  });

  constructor() {
    this.seo.setPage({
      title: 'Kütahya Taksileri — Kütahya Taksi Ağı',
      description:
        "Kütahya'daki doğrulanmış taksi işletmelerinin tam listesi. Telefon, WhatsApp ve yol tarifi tek tıkla.",
      path: '/taksi',
    });

    effect(() => {
      const list = this.businesses.value();
      if (list && list.length > 0) {
        // §34: her öğe kendi canonical detay URL'sine işaret eder.
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
