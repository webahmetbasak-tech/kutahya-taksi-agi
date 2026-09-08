import { DOCUMENT, inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { APP_CONFIG } from '@core/config/app-config';

const SITE_NAME = 'Kütahya Taksi Ağı';

/** Bir sayfanın SEO/OG bilgileri. `path` her zaman `/` ile başlar. */
export interface SeoPageConfig {
  title: string;
  description: string;
  path: string;
  /**
   * Bu SAYFAYA ÖZGÜ noindex kararı (ör. eşiği geçmemiş bir landing page).
   * Production DIŞINDA zaten her zaman noindex uygulanır (bkz. app.ts) —
   * bu alan yalnızca production'da EK bir noindex nedeni ekler, production'ı
   * asla index'e "geri açmaz".
   */
  noindex?: boolean;
  ogType?: 'website' | 'article';
}

/**
 * Sayfa başına title/description/canonical/OpenGraph/Twitter/robots'u tek
 * yerden yöneten servis (§62, ARCHITECTURE.md §9).
 *
 * NEDEN MERKEZİ? Faz 1'de her sayfa kendi `Title.setTitle()`'ını çağırıyordu
 * ve route config'inde ayrıca statik `title:` alanları vardı — iki farklı
 * kaynak, kolayca birbirinden sapabilirdi. Faz 4'te bu servis TEK doğruluk
 * kaynağı oldu; `app.routes.ts`'teki statik `title:` alanları kaldırıldı.
 *
 * ROBOTS ÇAKIŞMASI YOK: `app.ts` bootstrap'ta production-dışı ortamda
 * `noindex` yazar — bu, hiçbir sayfa `setPage()` çağırmayı unutsa bile devrede
 * kalan bir GÜVENLİK AĞIDIR. Bu servis her `setPage()` çağrısında AYNI kuralı
 * (`!production || page.noindex`) yeniden uygular; production'da normal
 * sayfalar için `index, follow`, düşük değerli sayfalar (ör. eşiği geçmemiş
 * landing page) için `noindex, follow` üretir. İki mekanizma asla çelişmez:
 * hiçbiri production-dışı bir ortamı "indexlenebilir" yapamaz.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly config = inject(APP_CONFIG);

  setPage(page: SeoPageConfig): void {
    // KASITLI OLARAK `@env`'in `absoluteUrl()` yardımcısını KULLANMIYORUZ:
    // o modül-seviyesi `environment` sabitini okur ve testte mock'lanamaz.
    // Bu servis her zaman kendi enjekte edilen `APP_CONFIG`'ini kullanır —
    // tek doğruluk kaynağı DI üzerinden akar, testler gerçek ortamdan sızıntı
    // almadan farklı `siteUrl`/`production` senaryolarını doğrulayabilir.
    const canonicalUrl = `${this.config.siteUrl}${page.path === '/' ? '' : page.path}`;

    this.titleService.setTitle(page.title);
    this.updateTag('name', 'description', page.description);
    this.setCanonical(canonicalUrl);

    this.updateTag('property', 'og:title', page.title);
    this.updateTag('property', 'og:description', page.description);
    this.updateTag('property', 'og:url', canonicalUrl);
    this.updateTag('property', 'og:type', page.ogType ?? 'website');
    this.updateTag('property', 'og:site_name', SITE_NAME);
    this.updateTag('property', 'og:locale', 'tr_TR');

    this.updateTag('name', 'twitter:card', 'summary');
    this.updateTag('name', 'twitter:title', page.title);
    this.updateTag('name', 'twitter:description', page.description);

    this.meta.updateTag({ name: 'robots', content: this.resolveRobots(page.noindex ?? false) });
  }

  /**
   * Üç farklı sonuç mümkündür:
   * - production DIŞI  -> her zaman `noindex, nofollow` (güvenlik ağı, app.ts ile aynı kural)
   * - production + sayfa noindex istiyor -> `noindex, follow` (bu sayfa indexlenmesin ama
   *   linkleri takip edilsin — ör. eşiği geçmemiş bir landing page yine de internal linking
   *   sağlar, sadece kendisi arama sonucunda görünmesin)
   * - production + normal sayfa -> `index, follow`
   */
  private resolveRobots(pageWantsNoindex: boolean): string {
    if (!this.config.production) {
      return 'noindex, nofollow';
    }
    return pageWantsNoindex ? 'noindex, follow' : 'index, follow';
  }

  private updateTag(attribute: 'name' | 'property', key: string, content: string): void {
    this.meta.updateTag({ [attribute]: key, content } as Record<string, string>);
  }

  private setCanonical(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
