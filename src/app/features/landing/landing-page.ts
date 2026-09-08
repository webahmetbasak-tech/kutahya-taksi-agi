import { Component, computed, effect, inject, input, RESPONSE_INIT } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LandingPageRepository } from '@core/data/landing-page.repository';
import { BusinessRepository } from '@core/data/business.repository';
import { SeoService } from '@core/seo/seo.service';
import { SchemaService } from '@core/schema/schema.service';
import { buildBreadcrumbList, buildItemList } from '@core/schema/builders';
import { BusinessList } from '@shared/components/business-list';
import { Breadcrumb } from '@shared/components/breadcrumb';
import { Skeleton } from '@shared/ui/skeleton';
import { NotFoundPage } from '@features/not-found/not-found-page';
import { absoluteUrl } from '@env';

/**
 * `landing_pages` tablosundan gelen SEO sayfaları — ör. `/kutahya-724-taksi`
 * (§30, §31). Route: `app.routes.ts`'te `:slug` — diğer TÜM route'lardan
 * sonra tanımlı, aksi halde `/hakkinda` gibi sabit sayfaları gölgelerdi.
 *
 * `:slug` tek segmentli HER path'i yakaladığı için gerçek `**` wildcard'ını
 * (NotFoundPage) tek segmentli rastgele URL'ler için hiç çalıştırmaz — bu
 * yüzden "bulunamadı" durumunda `<app-not-found-page>` doğrudan yeniden
 * kullanılır: kullanıcı hep AYNI, markalı 404 sayfasını görür, HTTP durumu
 * (404) yine BURADA `RESPONSE_INIT` ile ayarlanır (`NotFoundPage` bunu yapmaz).
 *
 * THIN CONTENT KAPISI KOD DEĞİL, VERİTABANI KURALIDIR: `landing_page_stats`
 * view'ı `is_indexable`'ı zaten hesaplıyor (§31). Bu component yalnızca o
 * değeri okuyup `SeoService`'e `noindex` olarak iletir — eşiği burada TEKRAR
 * uygulamaz.
 *
 * CANONICAL KARARI (ARCHITECTURE.md §8): her landing page KENDİ URL'sine
 * self-canonical'dır; `/taksi` listesine yönlendirilmez. Çünkü bir sayfa
 * ancak gerçekten farklı, ayrı içerikle (kendi h1/intro'su VE ≥3 gerçek
 * işletmeyle) yayına girebiliyor — yapısal olarak `/taksi` ile aynı içerik
 * OLAMAZ, bu yüzden kopya içerik riski `min_business_count` eşiğiyle zaten
 * önlenmiş durumda.
 */
@Component({
  selector: 'app-landing-page',
  imports: [RouterLink, BusinessList, Breadcrumb, Skeleton, NotFoundPage],
  template: `
    @if (page.isLoading()) {
      <div class="container page">
        <app-skeleton height="2rem" width="60%" />
      </div>
    } @else if (page.value(); as p) {
      <div class="container page">
        <app-breadcrumb [items]="[{ label: 'Ana Sayfa', path: '/' }, { label: p.h1 }]" />

        <h1 class="page-title">{{ p.h1 }}</h1>

        @if (p.intro) {
          <p class="lead">{{ p.intro }}</p>
        }

        <app-business-list
          [businesses]="businesses.value() ?? []"
          [loading]="businesses.isLoading()"
          emptyTitle="Bu kriterde henüz yayınlanmış işletme yok"
          emptyDescription="Doğrulanmamış bilgi yayınlamıyoruz. İşletme sahibiyseniz profilinizi ekleyebilirsiniz."
        >
          <a routerLink="/isletme-ekle" class="btn btn--brand">İşletmemi Yayınla</a>
        </app-business-list>
      </div>
    } @else {
      <app-not-found-page />
    }
  `,
  styles: `
    .page {
      padding-block: var(--sp-8) var(--sp-12);
    }

    .lead {
      margin-block: var(--sp-2) var(--sp-8);
      max-width: 60ch;
    }
  `,
})
export class LandingPage {
  private readonly repo = inject(LandingPageRepository);
  private readonly businessRepo = inject(BusinessRepository);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });
  private readonly seo = inject(SeoService);
  private readonly schema = inject(SchemaService);

  readonly slug = input.required<string>();

  protected readonly page = rxResource({
    params: () => this.slug(),
    stream: ({ params }) => this.repo.bySlug(params),
  });

  private readonly target = computed(() => {
    const p = this.page.value();
    return p ? { locationId: p.location_id, serviceId: p.service_id } : undefined;
  });

  protected readonly businesses = rxResource({
    params: () => this.target(),
    stream: ({ params }) => this.businessRepo.forLandingPage(params),
  });

  constructor() {
    effect(() => {
      if (this.page.status() !== 'resolved') {
        return;
      }
      const p = this.page.value();

      if (!p) {
        // Başlık/açıklama/noindex'i `<app-not-found-page>` kendi constructor'ında
        // ayarlar (bkz. yukarıdaki not) — burada yalnızca HTTP durum kodu.
        if (this.responseInit) {
          this.responseInit.status = 404;
        }
        this.schema.remove('breadcrumb');
        this.schema.remove('itemlist');
        return;
      }

      this.seo.setPage({
        title: p.title,
        description:
          p.meta_description ?? `${p.h1} — Kütahya Taksi Ağı'nda doğrulanmış işletmeler.`,
        path: `/${p.slug}`,
        // is_indexable BURADA HESAPLANMAZ — landing_page_stats view'ından
        // (§31) doğrudan okunur. Tek doğruluk kaynağı veritabanı.
        noindex: !p.is_indexable,
      });

      this.schema.set(
        'breadcrumb',
        buildBreadcrumbList([{ name: 'Ana Sayfa', url: absoluteUrl('/') }, { name: p.h1 }]),
      );

      const list = this.businesses.value();
      if (list && list.length > 0) {
        this.schema.set(
          'itemlist',
          buildItemList(
            list.map((b) => ({ name: b.business_name, url: absoluteUrl(`/taksi/${b.slug}`) })),
          ),
        );
      } else {
        this.schema.remove('itemlist');
      }
    });
  }
}
