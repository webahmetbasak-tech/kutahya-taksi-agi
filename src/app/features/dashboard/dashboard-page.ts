import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Spinner } from '@shared/ui/spinner';
import { SeoService } from '@core/seo/seo.service';

/**
 * İşletme sahibi paneli — `/panel` (§27).
 *
 * `RenderMode.Client` ile çalışır: SEO'ya konu olmadığı için sunucuda render
 * edilmez, lazy chunk olarak yalnızca giriş yapmış kullanıcıya iner.
 *
 * `isPlatformBrowser` kontrolü aynı zamanda Client render modunun gerçekten
 * çalıştığının kanıtıdır — sunucu HTML'inde bu sayfanın içeriği bulunmaz.
 *
 * Faz 6 tamamlandı: analytics veri hattı (event toplama + gecelik rollup)
 * çalışıyor. Bu sayfanın kendisi henüz istatistik GÖSTERMİYOR çünkü
 * `analytics_daily` RLS'i yalnızca işletme sahibine/admin'e açık (§54) — o da
 * Faz 7'nin auth/claim sistemine bağlı. Faz 7: auth guard + claim durumu +
 * gerçek istatistik görünümü.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [Spinner],
  template: `
    <div class="container page">
      @if (isBrowser()) {
        <h1 class="page-title">İşletme Paneli</h1>
        <p class="lead">
          Profil görüntülenmeleri ve iletişim tıklamalarınızı buradan takip edeceksiniz.
        </p>
        <div class="card notice">
          <p><strong>Panel henüz açılmadı.</strong></p>
          <p class="muted">
            Veri toplama altyapısı hazır — istatistikler, girişinizle birlikte Faz 7'de burada
            görünecek.
          </p>
        </div>
      } @else {
        <app-spinner label="Panel yükleniyor" />
      }
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
export class DashboardPage {
  protected readonly isBrowser = signal(isPlatformBrowser(inject(PLATFORM_ID)));
  private readonly seo = inject(SeoService);

  constructor() {
    // Kimlik doğrulama arkasındaki özel bir alan — her koşulda noindex (§54).
    this.seo.setPage({
      title: 'İşletme Paneli — Kütahya Taksi Ağı',
      description: 'İşletme sahibi paneli.',
      path: '/panel',
      noindex: true,
    });
  }
}
