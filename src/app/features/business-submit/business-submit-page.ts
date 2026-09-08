import { Component } from '@angular/core';

/**
 * "İşletmemi Yayınla" — `/isletme-ekle` (§26).
 *
 * Faz 1'de yalnızca sayfa iskeleti. Form, doğrulama, telefon normalizasyonu,
 * duplicate tespiti ve fotoğraf yükleme Faz 8'de gelecek (Supabase gerektirir).
 */
@Component({
  selector: 'app-business-submit-page',
  template: `
    <div class="container page">
      <h1 class="page-title">İşletmemi Yayınla</h1>
      <p class="lead">
        Taksi işletmenizi Kütahya Taksi Ağı'na ücretsiz ekleyin. Müşterilerin sizi daha kolay
        bulmasını sağlayın.
      </p>

      <div class="card notice">
        <p><strong>Başvuru formu henüz açılmadı.</strong></p>
        <p class="muted">
          Platform hazırlanma aşamasında. Form yayına alındığında işletmenizi buradan ekleyebilecek,
          bilgilerinizi kendiniz güncelleyebileceksiniz.
        </p>
      </div>
    </div>
  `,
  styles: `
    .page {
      padding-block: var(--sp-8) var(--sp-4);
      max-width: 46rem;
    }

    .lead {
      margin-block: var(--sp-3) var(--sp-8);
    }

    .notice p + p {
      margin-block-start: var(--sp-2);
    }
  `,
})
export class BusinessSubmitPage {}
