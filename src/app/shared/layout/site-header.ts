import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/**
 * Site başlığı.
 *
 * Mobilde menü açılır kapanır; masaüstünde yatay. İşletme sahibine yönelik CTA
 * (§76) burada ikincil olarak durur — birincil hedef müşterinin taksi bulmasıdır,
 * bu yüzden başlıkta müşteri navigasyonu önce gelir.
 */
@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="header">
      <div class="container header__inner">
        <a routerLink="/" class="header__brand" (click)="closeMenu()">
          <span class="header__mark" aria-hidden="true">KT</span>
          <span class="header__name">Kütahya Taksi Ağı</span>
        </a>

        <button
          type="button"
          class="header__toggle"
          [attr.aria-expanded]="menuOpen()"
          aria-controls="site-nav"
          (click)="toggleMenu()"
        >
          <span class="visually-hidden">Menüyü {{ menuOpen() ? 'kapat' : 'aç' }}</span>
          <span class="header__burger" aria-hidden="true"></span>
        </button>

        <nav id="site-nav" class="header__nav" [class.header__nav--open]="menuOpen()">
          <ul class="header__links">
            <li>
              <a routerLink="/taksi" routerLinkActive="is-active" (click)="closeMenu()">Taksiler</a>
            </li>
            <li>
              <a routerLink="/hakkinda" routerLinkActive="is-active" (click)="closeMenu()">
                Hakkında
              </a>
            </li>
          </ul>
          <a
            routerLink="/isletme-ekle"
            class="btn btn--secondary header__cta"
            (click)="closeMenu()"
          >
            İşletmemi Yayınla
          </a>
        </nav>
      </div>
    </header>
  `,
  styles: `
    .header {
      position: sticky;
      top: 0;
      z-index: var(--z-header);
      background-color: var(--c-surface);
      border-bottom: 1px solid var(--c-border);
    }

    .header__inner {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      min-height: var(--header-height);
    }

    .header__brand {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-3);
      text-decoration: none;
      font-weight: var(--fw-bold);
      margin-inline-end: auto;
    }

    .header__mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: var(--radius-md);
      background-color: var(--c-brand);
      color: var(--c-on-brand);
      font-size: var(--fs-sm);
      letter-spacing: -0.02em;
    }

    .header__name {
      font-size: var(--fs-base);
      letter-spacing: -0.01em;
    }

    .header__toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--tap-min);
      height: var(--tap-min);
      margin-inline-end: calc(-1 * var(--sp-3));
      border-radius: var(--radius-md);
    }

    .header__burger,
    .header__burger::before,
    .header__burger::after {
      display: block;
      width: 20px;
      height: 2px;
      background-color: var(--c-text);
      border-radius: var(--radius-full);
    }

    .header__burger {
      position: relative;
    }

    .header__burger::before,
    .header__burger::after {
      content: '';
      position: absolute;
    }

    .header__burger::before {
      top: -6px;
    }

    .header__burger::after {
      top: 6px;
    }

    .header__nav {
      display: none;
    }

    .header__nav--open {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
      position: absolute;
      inset-inline: 0;
      top: var(--header-height);
      padding: var(--sp-4) var(--container-pad) var(--sp-6);
      background-color: var(--c-surface);
      border-bottom: 1px solid var(--c-border);
      box-shadow: var(--shadow-md);
    }

    .header__links {
      display: flex;
      flex-direction: column;
      gap: var(--sp-1);
    }

    .header__links a {
      display: flex;
      align-items: center;
      min-height: var(--tap-min);
      padding-inline: var(--sp-2);
      border-radius: var(--radius-md);
      text-decoration: none;
      font-weight: var(--fw-medium);
    }

    .header__links a.is-active {
      color: var(--c-action-strong);
      background-color: var(--c-action-soft);
    }

    @media (min-width: 768px) {
      .header__toggle {
        display: none;
      }

      .header__nav,
      .header__nav--open {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--sp-5);
        position: static;
        padding: 0;
        border: none;
        box-shadow: none;
        background: none;
      }

      .header__links {
        flex-direction: row;
        gap: var(--sp-4);
      }

      .header__links a {
        min-height: auto;
        padding-inline: 0;
      }

      .header__links a.is-active {
        background: none;
      }

      .header__cta {
        min-height: 40px;
        padding: var(--sp-2) var(--sp-4);
        font-size: var(--fs-sm);
      }

      .header__name {
        font-size: var(--fs-lg);
      }
    }
  `,
})
export class SiteHeader {
  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
