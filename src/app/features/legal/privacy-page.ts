import { Component, inject } from '@angular/core';
import { SeoService } from '@core/seo/seo.service';

/**
 * `/gizlilik` — prerender edilir.
 *
 * DİKKAT: Buradaki metin hukuki bir belge DEĞİLDİR. Yalnızca sistemin fiilen ne
 * yaptığını dürüstçe tarif eder. Yayına çıkmadan önce KVKK aydınlatma metni,
 * gizlilik politikası ve çerez metinleri hukuki inceleme ile hazırlanmalıdır
 * (§56, PROJECT_PLAN.md R2).
 */
@Component({
  selector: 'app-privacy-page',
  template: `
    <div class="container page">
      <h1 class="page-title">Gizlilik</h1>

      <div class="card notice">
        <p>
          <strong>Bu metin taslaktır.</strong> Nihai gizlilik politikası ve KVKK aydınlatma metni
          hukuki inceleme sonrası yayınlanacaktır.
        </p>
      </div>

      <h2 class="section-title">Ne topluyoruz?</h2>
      <p>
        Site kullanımını ölçmek için sayfa görüntülenmesi ve iletişim butonlarına yapılan tıklamalar
        sayılır. Bu ölçüm için tarayıcı oturumuna özel, kişiyle ilişkilendirilmeyen geçici bir
        oturum kimliği kullanılır.
      </p>

      <h2 class="section-title">Ne toplamıyoruz?</h2>
      <p>
        Ad, e-posta, telefon gibi kişisel bilgiler ölçüm kayıtlarında tutulmaz. IP adresi saklanmaz.
        Reklam amaçlı takip çerezi kullanılmaz. Üçüncü taraf analiz servisi kullanılmaz.
      </p>

      <h2 class="section-title">İşletme bilgileri</h2>
      <p>
        Rehberde yer alan işletme bilgilerinin kaynağı kayıt altında tutulur. Profilinizin
        kaldırılmasını talep edebilirsiniz — her işletme profilinde bulunan "Bu profilin
        kaldırılmasını talep et" bağlantısı bu iş için yeterlidir, hesap açmanız gerekmez. Bir
        bilginin düzeltilmesi için işletmenizi sahiplenip kendiniz güncelleyebilir ya da aynı
        bağlantı üzerinden talebinizi iletebilirsiniz.
      </p>
    </div>
  `,
  styles: `
    .page {
      padding-block: var(--sp-8) var(--sp-4);
      max-width: 44rem;
    }

    .notice {
      margin-block: var(--sp-6);
    }

    .section-title {
      margin-block: var(--sp-8) var(--sp-3);
    }
  `,
})
export class PrivacyPage {
  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.setPage({
      title: 'Gizlilik — Kütahya Taksi Ağı',
      description: 'Kütahya Taksi Ağı gizlilik ve veri toplama ilkeleri.',
      path: '/gizlilik',
      // Metin taslak (bkz. yukarıdaki not) — nihai hukuki inceleme tamamlanana
      // kadar arama sonuçlarında görünmemeli.
      noindex: true,
    });
  }
}
