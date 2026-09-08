import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * 404 sayfası.
 *
 * HTTP durum kodu bileşende değil, `app.routes.server.ts` içindeki wildcard
 * route'un `status: 404` alanıyla ayarlanır — böylece crawler'lar gerçekten 404
 * görür, "soft 404" oluşmaz (§64).
 */
@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  template: `
    <div class="container page">
      <p class="code">404</p>
      <h1 class="page-title">Sayfa bulunamadı</h1>
      <p class="lead">Aradığınız sayfa taşınmış veya hiç var olmamış olabilir.</p>
      <div class="actions">
        <a routerLink="/" class="btn btn--primary">Ana Sayfa</a>
        <a routerLink="/taksi" class="btn btn--secondary">Tüm Taksiler</a>
      </div>
    </div>
  `,
  styles: `
    .page {
      padding-block: var(--sp-16) var(--sp-12);
      max-width: 40rem;
      text-align: center;
    }

    .code {
      font-size: var(--fs-3xl);
      font-weight: var(--fw-bold);
      color: var(--c-text-subtle);
      letter-spacing: 0.05em;
    }

    .lead {
      margin-block: var(--sp-3) var(--sp-8);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-3);
      justify-content: center;
    }
  `,
})
export class NotFoundPage {}
