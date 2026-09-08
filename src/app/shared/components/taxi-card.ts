import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { BusinessCard } from '@core/data/models';
import { directionsHref } from '@shared/utils/directions';
import { formatPhoneDisplay, telHref, whatsappHref } from '@shared/utils/phone';
import { formatTrDate } from '@shared/utils/date';

/**
 * Taksi liste kartı (§23, §46).
 *
 * CTA hiyerarşisi (§76): Ara > WhatsApp > Yol Tarifi. Telefon yoksa "Ara"
 * butonu değil, dürüst bir "telefon bilgisi yok" mesajı gösterilir — uydurma
 * numara YOK (§20). WhatsApp yalnızca `whatsapp_e164` doluysa görünür (§48).
 *
 * Doğrulama rozeti yalnızca veriden geliyorsa gösterilir (§41): sabit metin
 * değil, `last_verified_at` doluysa ve durum uygunsa render edilir.
 */
@Component({
  selector: 'app-taxi-card',
  imports: [RouterLink],
  template: `
    <article class="card taxi-card">
      <header class="taxi-card__header">
        <h3 class="taxi-card__name">
          <a [routerLink]="['/taksi', business().slug]">{{ business().business_name }}</a>
        </h3>
        @if (verifiedLabel(); as label) {
          <span class="badge badge--verified">{{ label }}</span>
        }
      </header>

      @if (locationLabel(); as loc) {
        <p class="taxi-card__location muted">{{ loc }}</p>
      }

      @if (distanceLabel(); as dist) {
        <p class="taxi-card__distance muted">{{ dist }}</p>
      }

      <div class="taxi-card__actions">
        @if (business().phone_e164; as phone) {
          <a class="btn btn--primary taxi-card__action" [href]="telHref(phone)">
            📞 Ara — {{ phoneLabel() }}
          </a>
        } @else {
          <p class="taxi-card__no-phone muted">Telefon bilgisi yok</p>
        }

        @if (business().whatsapp_e164; as wa) {
          <a
            class="btn btn--secondary taxi-card__action"
            [href]="whatsappHref(wa)"
            target="_blank"
            rel="noopener"
          >
            💬 WhatsApp
          </a>
        }

        <a
          class="btn btn--secondary taxi-card__action"
          [href]="directionsUrl()"
          target="_blank"
          rel="noopener"
        >
          🗺️ Yol Tarifi
        </a>
      </div>
    </article>
  `,
  styles: `
    .taxi-card {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }

    .taxi-card__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--sp-2);
    }

    .taxi-card__name {
      font-size: var(--fs-lg);
    }

    .taxi-card__name a {
      text-decoration: none;
    }

    .taxi-card__name a:hover {
      text-decoration: underline;
    }

    .taxi-card__location,
    .taxi-card__distance,
    .taxi-card__no-phone {
      font-size: var(--fs-sm);
    }

    .taxi-card__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-2);
      margin-block-start: var(--sp-2);
    }

    .taxi-card__action {
      flex: 1 1 auto;
    }
  `,
})
export class TaxiCard {
  readonly business = input.required<BusinessCard>();
  /** Yalnızca "yakınımdaki taksiler" sonuçlarında dolu. */
  readonly distanceMeters = input<number>();

  protected readonly verifiedLabel = computed(() => {
    const b = this.business();
    if (b.verification_status === 'owner_claimed' && b.last_verified_at) {
      return 'İşletme sahibi doğruladı';
    }
    if (b.verification_status === 'verified' && b.last_verified_at) {
      return `Doğrulandı — ${formatTrDate(b.last_verified_at)}`;
    }
    return null;
  });

  protected readonly locationLabel = computed(() => {
    const b = this.business();
    return [b.neighborhood, b.district].filter(Boolean).join(', ') || null;
  });

  protected readonly distanceLabel = computed(() => {
    const meters = this.distanceMeters();
    if (meters === undefined) return null;
    const km = meters / 1000;
    return km < 1 ? `${Math.round(meters)} m uzaklıkta` : `${km.toFixed(1)} km uzaklıkta`;
  });

  protected readonly phoneLabel = computed(() => {
    const b = this.business();
    return b.phone_display ?? (b.phone_e164 ? formatPhoneDisplay(b.phone_e164) : '');
  });

  protected readonly directionsUrl = computed(() =>
    directionsHref({
      googleMapsUrl: this.business().google_maps_url,
      searchQuery: `${this.business().business_name}, Kütahya`,
    }),
  );

  protected readonly telHref = telHref;
  protected readonly whatsappHref = whatsappHref;
}
