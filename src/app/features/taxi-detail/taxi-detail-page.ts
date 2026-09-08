import { Component, computed, effect, inject, input, RESPONSE_INIT } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BusinessRepository } from '@core/data/business.repository';
import { Skeleton } from '@shared/ui/skeleton';
import { formatPhoneDisplay, telHref, whatsappHref } from '@shared/utils/phone';
import { directionsHref } from '@shared/utils/directions';
import { formatTrDate } from '@shared/utils/date';

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
 * `slug` route parametresi component input'una bağlanır (`withComponentInputBinding`).
 * SSR kanıtı: rastgele bir slug sunucu HTML'inde görünüyorsa (bulunamadı sayfası
 * olarak da olsa) render istek anında çalışıyor demektir — Faz 1'de bu şekilde
 * doğrulandı.
 *
 * İşletme bulunamazsa gerçek HTTP 404 döner (`RESPONSE_INIT`, yalnızca SSR'da
 * mevcuttur) — "soft 404" oluşmaz (§64).
 *
 * Güven sinyalleri (§41) yalnızca veriden geliyorsa gösterilir: doğrulama
 * rozeti `verification_status` + `last_verified_at` birlikte doluyken, kaynak
 * bilgisi her zaman `source_type`'tan, "son güncelleme" her zaman `updated_at`'tan.
 */
@Component({
  selector: 'app-taxi-detail-page',
  imports: [RouterLink, Skeleton],
  template: `
    <div class="container page">
      @if (business.isLoading()) {
        <app-skeleton height="2rem" width="60%" />
        <div class="skeleton-block">
          <app-skeleton height="1rem" width="40%" />
          <app-skeleton height="3rem" />
        </div>
      } @else if (business.value(); as b) {
        <nav class="breadcrumb muted" aria-label="Ekmek kırıntısı">
          <a routerLink="/taksi">Taksiler</a> / <span>{{ b.business_name }}</span>
        </nav>

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

    .breadcrumb {
      font-size: var(--fs-sm);
      margin-block-end: var(--sp-3);
    }

    .breadcrumb a {
      text-decoration: none;
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
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });
  private readonly title = inject(Title);

  /** `/taksi/:slug` route parametresinden gelir. */
  readonly slug = input.required<string>();

  protected readonly business = rxResource({
    params: () => this.slug(),
    stream: ({ params }) => this.repo.bySlug(params),
  });

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
      const business = this.business.value();
      if (business === null && this.responseInit) {
        this.responseInit.status = 404;
      }
      this.title.setTitle(
        business
          ? `${business.business_name} — Kütahya | Kütahya Taksi Ağı`
          : 'İşletme bulunamadı — Kütahya Taksi Ağı',
      );
    });
  }
}
