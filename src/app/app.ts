import { Component, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { SiteHeader } from '@shared/layout/site-header';
import { SiteFooter } from '@shared/layout/site-footer';
import { APP_CONFIG } from '@core/config/app-config';
import { SchemaService } from '@core/schema/schema.service';
import { buildOrganization, buildWebSite } from '@core/schema/builders';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SiteHeader, SiteFooter],
  template: `
    <a class="skip-link" href="#main">İçeriğe atla</a>
    <app-site-header />
    <main id="main" tabindex="-1">
      <router-outlet />
    </main>
    <app-site-footer />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
    }

    main {
      flex: 1;
    }

    main:focus {
      outline: none;
    }
  `,
})
export class App {
  private readonly config = inject(APP_CONFIG);
  private readonly meta = inject(Meta);
  private readonly schema = inject(SchemaService);

  constructor() {
    // Production dışı her ortam (development, Vercel preview) indekslenmez.
    // Bunu index.html'e sabit yazmak, production'da silmeyi unutma riski taşırdı.
    if (!this.config.production) {
      this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    }

    // Site geneli kimlik: bir kez, uygulama ömrü boyunca. `persistent: true`
    // olmadan bu bloklar ilk sayfa navigasyonunda silinirdi (bkz. schema.service.ts).
    this.schema.set('organization', buildOrganization(this.config.siteUrl), {
      persistent: true,
    });
    this.schema.set('website', buildWebSite(this.config.siteUrl), { persistent: true });
  }
}
