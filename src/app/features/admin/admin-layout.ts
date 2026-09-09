import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * `/admin` kabuğu — nav + `<router-outlet>`. Kimlik doğrulama/rol kontrolü
 * BURADA DEĞİL: `adminGuard` (`core/auth/admin.guard.ts`) route'a `canActivate`
 * ile bağlı, bu bileşen yalnızca zaten yetkili bir kullanıcı için render edilir.
 *
 * `RenderMode.Client`: tüm `/admin/**` (bkz. `app.routes.server.ts`).
 */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="container admin">
      <nav class="admin__nav" aria-label="Yönetim menüsü">
        <a routerLink="/admin" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }">
          Özet
        </a>
        <a routerLink="/admin/isletmeler" routerLinkActive="is-active">İşletmeler</a>
        <a routerLink="/admin/talepler" routerLinkActive="is-active">Talepler</a>
        <a routerLink="/admin/hizli-ekle" routerLinkActive="is-active">Hızlı Ekle</a>
        <a routerLink="/admin/hizmetler" routerLinkActive="is-active">Hizmetler</a>
        <a routerLink="/admin/bolgeler" routerLinkActive="is-active">Bölgeler</a>
        <a routerLink="/admin/degerlendirmeler" routerLinkActive="is-active">Değerlendirmeler</a>
        <a routerLink="/admin/analitik" routerLinkActive="is-active">Analitik</a>
        <a routerLink="/admin/kaldirma-talepleri" routerLinkActive="is-active">Kaldırma Talepleri</a>
        <a routerLink="/admin/kullanicilar" routerLinkActive="is-active">Kullanıcılar</a>
      </nav>
      <router-outlet />
    </div>
  `,
  styles: `
    .admin {
      padding-block: var(--sp-6) var(--sp-12);
    }

    .admin__nav {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-2);
      margin-block-end: var(--sp-6);
      padding-block-end: var(--sp-3);
      border-bottom: 1px solid var(--c-border);
    }

    .admin__nav a {
      display: inline-flex;
      align-items: center;
      min-height: var(--tap-min);
      padding-inline: var(--sp-3);
      border-radius: var(--radius-md);
      text-decoration: none;
      font-weight: var(--fw-medium);
      color: var(--c-text-muted);
    }

    .admin__nav a.is-active {
      color: var(--c-action-strong);
      background-color: var(--c-action-soft);
    }
  `,
})
export class AdminLayout {}
