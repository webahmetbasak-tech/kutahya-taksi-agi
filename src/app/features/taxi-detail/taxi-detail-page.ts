import { Component, computed, effect, inject, input, RESPONSE_INIT } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BusinessRepository } from '@core/data/business.repository';
import { ServiceRepository } from '@core/data/service.repository';
import { LocationRepository } from '@core/data/location.repository';
import type { BusinessDetail, SlugResolution } from '@core/data/models';
import { SeoService } from '@core/seo/seo.service';
import { SchemaService } from '@core/schema/schema.service';
import { buildBreadcrumbList, buildLocalBusiness } from '@core/schema/builders';
import { Breadcrumb } from '@shared/components/breadcrumb';
import { Skeleton } from '@shared/ui/skeleton';
import { formatPhoneDisplay, telHref, whatsappHref } from '@shared/utils/phone';
import { directionsHref } from '@shared/utils/directions';
import { formatTrDate } from '@shared/utils/date';
import { absoluteUrl } from '@env';

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Ekip tarafından girildi',
  public_business_listing: 'Kamuya açık ilan (ör. durak levhası)',
  owner_submitted: 'İşletme sahibi tarafından bildirildi',
  owner_verified: 'İşletme sahibi tarafından doğrulandı',
  osm: 'OpenStreetMap (açık veri)',
};

/**
 * Taksi detay sayfası — `/taksi/:slug` (§24).
 *
 * İKİ AŞAMALI BULUNAMADI MANTIĞI (§64): `bySlug()` `null` dönünce hemen 404
 * denmez. Yalnızca O ZAMAN (nadir yol) `resolveMissingSlug()` çağrılır ve üç
 * gerçek durumdan biri uygulanır:
 *   - 'redirect'  -> 301 + Location header (slug değişmiş, işletme hâlâ aktif)
 *   - 'archived'  -> 410 (işletme kalıcı olarak kaldırılmış)
 *   - 'not_found' -> 404 (hiç var olmamış)
 * Bu tek ek istek normal sayfa görüntülemede HİÇ yapılmaz — yalnızca zaten
 * başarısız olmuş bir arama sonrası.
 *
 * `RESPONSE_INIT` yalnızca SSR'da mevcuttur (`inject(..., {optional:true})`);
 * tarayıcıda `null` gelir ve durum kodu ayarlama no-op olur — zaten tarayıcı
 * bir HTTP durum kodu ayarlayamaz, bu doğru davranıştır.
 */
@Component({
  selector: 'app-taxi-detail-page',
  imports: [RouterLink, Skeleton, Breadcrumb],
  template: `
    <div class="container page">
      @if (business.isLoading()) {
        <app-skeleton height="2rem" width="60%" />
        <div class="skeleton-block">
          <app-skeleton height="1rem" width="40%" />
          <app-skeleton height="3rem" />
        </div>
      } @else if (business.value(); as b) {
        <app-breadcrumb
          [items]="[{ label: 'Taksiler', path: '/taksi' }, { label: b.business_name }]"
        />

        <h1 class="page-title">{{ b.business_name }} — Kütahya</h1>

        @if (locationLabel(); as loc) {
          <p class="lead">{{ loc }}</p>
        }

        @if (verifiedLabel(); as label) {
          <span class="badge badge--verified detail-badge">{{ label }}</span>
        }

        <div class="actions">
          @if (b.phone_e164; as phone) {
            <a class="btn btn--primary" [href]="telHref(phone)">📞 Ara — {{ phoneLabel() }}</a>
          } @else {
            <p class="no-phone muted">
              Bu işletmenin telefon numarası henüz doğrulanmadı. İşletme sahibiyseniz
              <a routerLink="/isletme-ekle">bilgilerinizi ekleyebilirsiniz</a>.
            </p>
          }
          @if (b.whatsapp_e164; as wa) {
            <a class="btn btn--secondary" [href]="whatsappHref(wa)" target="_blank" rel="noopener">
              💬 WhatsApp
            </a>
          }
          <a class="btn btn--secondary" [href]="directionsUrl()" target="_blank" rel="noopener">
            🗺️ Yol Tarifi
          </a>
        </div>

        @if (b.description) {
          <section class="section" aria-labelledby="about-heading">
            <h2 id="about-heading" class="section-title">Hakkında</h2>
            <p>{{ b.description }}</p>
          </section>
        }

        @if (b.address) {
          <section class="section" aria-labelledby="address-heading">
            <h2 id="address-heading" class="section-title">Adres</h2>
            <p>{{ b.address }}, {{ b.city }}</p>
          </section>
        }

        @if (b.website) {
          <section class="section" aria-labelledby="website-heading">
            <h2 id="website-heading" class="section-title">Web sitesi</h2>
            <a [href]="b.website" target="_blank" rel="noopener">{{ b.website }}</a>
          </section>
        }

        @if ((services.value() ?? []).length > 0) {
          <section class="section" aria-labelledby="services-heading">
            <h2 id="services-heading" class="section-title">Hizmetler</h2>
            <ul class="chip-row">
              @for (s of services.value() ?? []; track s.id) {
                <li>
                  <a class="chip" [routerLink]="['/hizmet', s.slug]">{{ s.name }}</a>
                </li>
              }
            </ul>
          </section>
        }

        @if ((locations.value() ?? []).length > 0) {
          <section class="section" aria-labelledby="areas-heading">
            <h2 id="areas-heading" class="section-title">Hizmet Bölgeleri</h2>
            <ul class="chip-row">
              @for (loc of locations.value() ?? []; track loc.id) {
                <li>
                  <a class="chip" [routerLink]="['/bolge', loc.slug]">{{ loc.name }}</a>
                </li>
              }
            </ul>
          </section>
        }

        <section class="section source-info" aria-labelledby="source-heading">
          <h2 id="source-heading" class="section-title">Bilgi kaynağı ve güncellik</h2>
          <p class="muted">{{ sourceLabel() }}</p>
          <p class="muted">Son güncelleme: {{ updatedLabel() }}</p>
        </section>

        <section class="section owner-cta" aria-labelledby="owner-heading">
          <h2 id="owner-heading" class="section-title">Bu işletme size mi ait?</h2>
          <p class="muted">
            Profilinizi ücretsiz sahiplenin, bilgilerinizi güncelleyin, müşterilerin sizi daha kolay
            bulmasını sağlayın.
          </p>
          <a class="btn btn--brand" [routerLink]="['/taksi', b.slug, 'sahiplen']">
            Profilimi Sahiplen
          </a>
        </section>
      } @else if (isArchived()) {
        <h1 class="page-title">Bu işletme kapatıldı</h1>
        <p class="lead">
          <code class="slug">{{ slug() }}</code> profili kalıcı olarak kaldırıldı.
        </p>
        <a routerLink="/taksi" class="btn btn--secondary">Tüm Taksileri Gör</a>
      } @else {
        <h1 class="page-title">İşletme profili bulunamadı</h1>
        <p class="lead">
          <code class="slug">{{ slug() }}</code> adresinde yayınlanmış bir taksi işletmesi yok.
        </p>
        <p class="muted">
          Rehber hazırlanma aşamasında. Bu işletme size aitse profilinizi ücretsiz
          oluşturabilirsiniz.
        </p>
        <div class="actions">
          <a routerLink="/taksi" class="btn btn--secondary">Tüm Taksileri Gör</a>
          <a routerLink="/isletme-ekle" class="btn btn--brand">İşletmemi Yayınla</a>
        </div>
      }
    </div>
  `,
  styles: `
    .page {
      padding-block: var(--sp-8) var(--sp-12);
      max-width: 46rem;
    }

    .lead {
      margin-block: var(--sp-2) var(--sp-3);
    }

    .detail-badge {
      margin-block-end: var(--sp-4);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-3);
      margin-block: var(--sp-5) var(--sp-2);
    }

    .no-phone {
      max-width: 44ch;
    }

    .section {
      padding-block-start: var(--sp-6);
      border-top: 1px solid var(--c-border);
      margin-block-start: var(--sp-6);
    }

    .section-title {
      font-size: var(--fs-lg);
      margin-block-end: var(--sp-2);
    }

    .source-info p + p {
      margin-block-start: var(--sp-1);
    }

    .owner-cta {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--sp-3);
    }

    .slug {
      padding: var(--sp-1) var(--sp-2);
      background-color: var(--c-bg-muted);
      border-radius: var(--radius-sm);
      font-size: var(--fs-sm);
    }

    .skeleton-block {
      margin-block-start: var(--sp-4);
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }
  `,
})
export class TaxiDetailPage {
  private readonly repo = inject(BusinessRepository);
  private readonly serviceRepo = inject(ServiceRepository);
  private readonly locationRepo = inject(LocationRepository);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });
  private readonly seo = inject(SeoService);
  private readonly schema = inject(SchemaService);

  /** `/taksi/:slug` route parametresinden gelir. */
  readonly slug = input.required<string>();

  protected readonly business = rxResource({
    params: () => this.slug(),
    stream: ({ params }) => this.repo.bySlug(params),
  });

  private readonly businessId = computed(() => this.business.value()?.id);

  protected readonly hours = rxResource({
    params: () => this.businessId(),
    stream: ({ params }) => this.repo.hours(params),
  });

  /** §42 entity ilişkileri: bu işletmenin sunduğu hizmetlere GERİ link. */
  protected readonly services = rxResource({
    params: () => this.businessId(),
    stream: ({ params }) => this.serviceRepo.forBusiness(params),
  });

  /** §42 entity ilişkileri: bu işletmenin hizmet verdiği bölgelere GERİ link. */
  protected readonly locations = rxResource({
    params: () => this.businessId(),
    stream: ({ params }) => this.locationRepo.forBusiness(params),
  });

  /** Yalnızca `business` "bulunamadı" ile çözüldüğünde bir değer üretir. */
  private readonly missingSlug = computed(() =>
    this.business.status() === 'resolved' && this.business.value() === null
      ? this.slug()
      : undefined,
  );

  protected readonly resolution = rxResource({
    params: () => this.missingSlug(),
    stream: ({ params }) => this.repo.resolveMissingSlug(params),
  });

  protected readonly isArchived = computed(() => this.resolution.value()?.outcome === 'archived');

  protected readonly locationLabel = computed(() => {
    const b = this.business.value();
    if (!b) return null;
    return [b.neighborhood, b.district].filter(Boolean).join(', ') || null;
  });

  protected readonly verifiedLabel = computed(() => {
    const b = this.business.value();
    if (!b) return null;
    if (b.verification_status === 'owner_claimed' && b.last_verified_at) {
      return 'İşletme sahibi tarafından doğrulandı';
    }
    if (b.verification_status === 'verified' && b.last_verified_at) {
      return `Doğrulandı — ${formatTrDate(b.last_verified_at)}`;
    }
    return null;
  });

  protected readonly phoneLabel = computed(() => {
    const b = this.business.value();
    if (!b) return '';
    return b.phone_display ?? (b.phone_e164 ? formatPhoneDisplay(b.phone_e164) : '');
  });

  protected readonly sourceLabel = computed(() => {
    const b = this.business.value();
    if (!b) return '';
    return SOURCE_LABELS[b.source_type] ?? b.source_type;
  });

  protected readonly updatedLabel = computed(() => {
    const b = this.business.value();
    return b ? formatTrDate(b.updated_at) : '';
  });

  protected readonly directionsUrl = computed(() => {
    const b = this.business.value();
    if (!b) return '#';
    return directionsHref({
      googleMapsUrl: b.google_maps_url,
      latitude: b.latitude,
      longitude: b.longitude,
      searchQuery: `${b.business_name}, Kütahya`,
    });
  });

  protected readonly telHref = telHref;
  protected readonly whatsappHref = whatsappHref;

  constructor() {
    effect(() => {
      if (this.business.status() !== 'resolved') {
        return;
      }
      const b = this.business.value();

      if (b) {
        this.applyFoundState(b);
        return;
      }

      this.applyMissingState();
    });
  }

  private applyFoundState(b: BusinessDetail): void {
    const path = `/taksi/${b.slug}`;

    this.seo.setPage({
      title: `${b.business_name} — Kütahya | Kütahya Taksi Ağı`,
      description:
        b.description ??
        `${b.business_name} — ${this.locationLabel() ?? 'Kütahya'} bölgesinde taksi hizmeti.`,
      path,
    });

    this.schema.set(
      'breadcrumb',
      buildBreadcrumbList([
        { name: 'Taksiler', url: absoluteUrl('/taksi') },
        { name: b.business_name },
      ]),
    );

    this.schema.set(
      'business',
      buildLocalBusiness({
        name: b.business_name,
        url: absoluteUrl(path),
        description: b.description,
        telephone: b.phone_e164,
        address: b.address,
        city: b.city,
        district: b.district,
        neighborhood: b.neighborhood,
        hours: this.hours.value() ?? [],
      }),
    );
  }

  /** `business` null döndüğünde: `resolution` sonucuna göre 301/410/404. */
  private applyMissingState(): void {
    this.schema.remove('business');
    this.schema.remove('breadcrumb');

    if (this.resolution.status() !== 'resolved') {
      return;
    }

    this.applyResolution(this.resolution.value());
  }

  private applyResolution(resolution: SlugResolution | undefined): void {
    if (resolution?.outcome === 'redirect' && resolution.new_slug) {
      if (this.responseInit) {
        this.responseInit.status = 301;
        this.responseInit.headers = { Location: `/taksi/${resolution.new_slug}` };
      }
      return;
    }

    if (resolution?.outcome === 'archived') {
      if (this.responseInit) {
        this.responseInit.status = 410;
      }
      this.seo.setPage({
        title: 'İşletme kapatıldı — Kütahya Taksi Ağı',
        description: 'Bu işletme profili kalıcı olarak kaldırıldı.',
        path: `/taksi/${this.slug()}`,
        noindex: true,
      });
      return;
    }

    if (this.responseInit) {
      this.responseInit.status = 404;
    }
    this.seo.setPage({
      title: 'İşletme bulunamadı — Kütahya Taksi Ağı',
      description: 'Aradığınız taksi işletmesi bulunamadı.',
      path: `/taksi/${this.slug()}`,
      noindex: true,
    });
  }
}
