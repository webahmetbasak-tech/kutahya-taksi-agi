import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Taksi detay sayfası — `/taksi/:slug` (§24).
 *
 * Faz 1'de veri katmanı yok, bu yüzden her slug için "bulunamadı" durumu gösterilir —
 * bu şu anda doğrudur, çünkü henüz yayınlanmış hiçbir işletme yok.
 *
 * `slug` route parametresi component input'una bağlanır (`withComponentInputBinding`).
 * Bu aynı zamanda SSR'ın gerçekten istek anında çalıştığının kanıtıdır: rastgele bir
 * slug'ın sunucu HTML'inde görünmesi, sayfanın önceden üretilmediğini gösterir.
 *
 * Faz 3: gerçek işletme verisi + Ara/WhatsApp/Yol Tarifi aksiyonları.
 * Faz 4: bulunamayan slug için 404, slug değişimi için 301 (`business_slug_history`).
 */
@Component({
  selector: 'app-taxi-detail-page',
  imports: [RouterLink],
  template: `
    <div class="container page">
      <h1 class="page-title">İşletme profili bulunamadı</h1>
      <p class="lead">
        <code class="slug">{{ slug() }}</code> adresinde yayınlanmış bir taksi işletmesi yok.
      </p>
      <p class="muted">
        Rehber hazırlanma aşamasında. Bu işletme size aitse profilinizi ücretsiz oluşturabilirsiniz.
      </p>
      <div class="actions">
        <a routerLink="/taksi" class="btn btn--secondary">Tüm Taksileri Gör</a>
        <a routerLink="/isletme-ekle" class="btn btn--brand">İşletmemi Yayınla</a>
      </div>
    </div>
  `,
  styles: `
    .page {
      padding-block: var(--sp-12) var(--sp-8);
      max-width: 46rem;
    }

    .lead {
      margin-block: var(--sp-3);
    }

    .slug {
      padding: var(--sp-1) var(--sp-2);
      background-color: var(--c-bg-muted);
      border-radius: var(--radius-sm);
      font-size: var(--fs-sm);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-3);
      margin-block-start: var(--sp-6);
    }
  `,
})
export class TaxiDetailPage {
  /** `/taksi/:slug` route parametresinden gelir. */
  readonly slug = input.required<string>();
}
