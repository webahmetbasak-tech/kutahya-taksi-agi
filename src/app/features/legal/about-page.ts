import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '@core/seo/seo.service';

/**
 * `/hakkinda` — statik içerik, `RenderMode.Prerender` ile build zamanında üretilir.
 *
 * Bu sayfa aynı zamanda prerender modunun çalıştığının kanıtıdır.
 */
@Component({
  selector: 'app-about-page',
  imports: [RouterLink],
  template: `
    <div class="container page">
      <h1 class="page-title">Hakkında</h1>

      <p class="lead">
        Kütahya Taksi Ağı, Kütahya'daki taksi işletmelerini tek yerde toplayan bir yerel işletme
        rehberidir.
      </p>

      <h2 class="section-title">Nasıl çalışır?</h2>
      <p>
        Taksi arayan kişiler işletmeleri listeler, bir profili açar ve doğrudan arar, WhatsApp'a
        geçer veya yol tarifi alır. Platform bir çağrı merkezi ya da yolculuk uygulaması değildir;
        müşteriyi doğrudan taksi işletmesine ulaştırır.
      </p>

      <h2 class="section-title">Bilgilerin doğruluğu</h2>
      <p>
        Yayınlanan her işletme bilgisinin kaynağı kayıt altında tutulur ve profillerde son doğrulama
        tarihi gösterilir. Doğrulanmamış telefon numarası, adres veya çalışma saati yayınlanmaz. Bir
        bilgi yanlışsa veya profilinizin kaldırılmasını istiyorsanız bize ulaşabilirsiniz.
      </p>

      <h2 class="section-title">İşletme sahipleri için</h2>
      <p>
        İşletmenizi ücretsiz ekleyebilir, bilgilerinizi kendiniz güncelleyebilirsiniz.
        <a routerLink="/isletme-ekle">İşletmemi Yayınla</a> sayfasından başlayabilirsiniz.
      </p>
    </div>
  `,
  styles: `
    .page {
      padding-block: var(--sp-8) var(--sp-4);
      max-width: 44rem;
    }

    .lead {
      margin-block: var(--sp-3) var(--sp-8);
    }

    .section-title {
      margin-block: var(--sp-8) var(--sp-3);
    }
  `,
})
export class AboutPage {
  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.setPage({
      title: 'Hakkında — Kütahya Taksi Ağı',
      description:
        'Kütahya Taksi Ağı nasıl çalışır, bilgilerin doğruluğu nasıl sağlanır ve işletme sahipleri neler yapabilir.',
      path: '/hakkinda',
    });
  }
}
