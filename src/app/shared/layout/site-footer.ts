import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Site alt bilgisi.
 *
 * Yıl `new Date()` ile hesaplanmıyor: SSR'da sunucu saati, tarayıcıda istemci saati
 * kullanılsaydı hydration uyuşmazlığı çıkardı. Telif satırı zaten bir başlangıç yılı
 * belirtiyor; dinamik yıl bu sayfada hiçbir değer katmıyor.
 */
@Component({
  selector: 'app-site-footer',
  imports: [RouterLink],
  template: `
    <footer class="footer">
      <div class="container footer__inner">
        <div class="footer__col">
          <p class="footer__brand">Kütahya Taksi Ağı</p>
          <p class="footer__desc">Kütahya'daki taksi işletmelerini tek yerde keşfedin.</p>
        </div>

        <nav class="footer__col" aria-label="Site bağlantıları">
          <p class="footer__heading">Keşfet</p>
          <ul class="footer__links">
            <li><a routerLink="/taksi">Tüm Taksiler</a></li>
            <li><a routerLink="/hakkinda">Hakkında</a></li>
          </ul>
        </nav>

        <nav class="footer__col" aria-label="İşletme sahipleri">
          <p class="footer__heading">İşletme Sahipleri</p>
          <ul class="footer__links">
            <li><a routerLink="/isletme-ekle">İşletmemi Yayınla</a></li>
          </ul>
        </nav>

        <nav class="footer__col" aria-label="Yasal">
          <p class="footer__heading">Yasal</p>
          <ul class="footer__links">
            <li><a routerLink="/gizlilik">Gizlilik Politikası</a></li>
          </ul>
        </nav>
      </div>

      <div class="container footer__bottom">
        <p class="muted">© 2026 Kütahya Taksi Ağı</p>
      </div>
    </footer>
  `,
  styles: `
    .footer {
      margin-block-start: var(--sp-16);
      padding-block: var(--sp-10) var(--sp-6);
      background-color: var(--c-bg-subtle);
      border-top: 1px solid var(--c-border);
      font-size: var(--fs-sm);
    }

    .footer__inner {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--sp-6);
    }

    .footer__brand {
      font-weight: var(--fw-bold);
      font-size: var(--fs-base);
    }

    .footer__desc {
      color: var(--c-text-muted);
      max-width: 34ch;
      margin-block-start: var(--sp-1);
    }

    .footer__heading {
      font-weight: var(--fw-semibold);
      margin-block-end: var(--sp-2);
    }

    .footer__links {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }

    .footer__links a {
      color: var(--c-text-muted);
      text-decoration: none;
    }

    .footer__links a:hover {
      color: var(--c-text);
      text-decoration: underline;
    }

    .footer__bottom {
      margin-block-start: var(--sp-8);
      padding-block-start: var(--sp-4);
      border-top: 1px solid var(--c-border);
    }

    @media (min-width: 640px) {
      .footer__inner {
        grid-template-columns: 2fr 1fr 1fr 1fr;
        gap: var(--sp-8);
      }
    }
  `,
})
export class SiteFooter {}
