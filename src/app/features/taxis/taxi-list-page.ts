import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyState } from '@shared/ui/empty-state';

/**
 * Taksi listesi — `/taksi` (§23).
 *
 * Faz 1'de sayfa iskeleti ve boş durum. Gerçek liste, kart bileşeni (Ara / WhatsApp /
 * Yol Tarifi) ve filtreler Faz 3'te; ItemList structured data Faz 4'te eklenecek.
 */
@Component({
  selector: 'app-taxi-list-page',
  imports: [RouterLink, EmptyState],
  template: `
    <div class="container page">
      <h1 class="page-title">Kütahya Taksileri</h1>
      <p class="lead">Kütahya'daki taksi işletmeleri. Her kayıt yayınlanmadan önce doğrulanır.</p>

      <app-empty-state
        title="Henüz yayınlanmış işletme yok"
        description="Doğrulanmamış bilgi yayınlamıyoruz. Kütahya'daki durakların iletişim bilgileri doğrulandıkça burada listelenecek."
      >
        <a routerLink="/isletme-ekle" class="btn btn--brand">İşletmemi Yayınla</a>
      </app-empty-state>
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
export class TaxiListPage {}
