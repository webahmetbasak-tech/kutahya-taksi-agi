import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { BusinessRepository } from '@core/data/business.repository';
import { LocationRepository } from '@core/data/location.repository';
import { ServiceRepository } from '@core/data/service.repository';
import { GeolocationService } from '@core/geo/geolocation.service';
import { BusinessList } from '@shared/components/business-list';
import { Skeleton } from '@shared/ui/skeleton';
import { SeoService } from '@core/seo/seo.service';
import { AnalyticsService } from '@core/analytics/analytics.service';

/**
 * Ana sayfa (§21, §22).
 *
 * Bölüm sırası: Hero → Yakınımdaki Taksiler → Popüler Bölgeler → Hizmetler →
 * İşletmeler → İşletme sahipleri CTA'sı. Prompt §22'deki "7/24 taksiler",
 * "Havalimanı transferi", "Şehirlerarası taksi" bölümleri BİLİNÇLİ OLARAK ayrı
 * ayrı gösterilmiyor: şu an 0 aktif işletme varken üç neredeyse özdeş boş
 * bölüm göstermek gerçek içerik değil doldurma olurdu (§75 ruhuna aykırı).
 * Bunun yerine tek bir "Hizmetler" bölümü hepsine bağlanıyor; iş letme sayısı
 * arttıkça Faz 4'te hizmet bazlı bölümler ayrılabilir.
 *
 * "Yerel rehber" (§22) bilerek eklenmedi — gerçek araştırılmış içerik
 * gerektirir, uydurulmuş rehber metni yazılmaz (§74).
 */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink, BusinessList, Skeleton],
  template: `
    <section class="hero">
      <div class="container hero__inner">
        <h1 class="hero__title">Kütahya'da Taksi Bul</h1>
        <p class="hero__lead">Kütahya'daki taksi işletmelerini tek yerde keşfedin.</p>
        <div class="hero__actions">
          <button type="button" class="btn btn--primary" (click)="findNearby()">
            📍 Yakınımdaki Taksileri Göster
          </button>
          <a routerLink="/taksi" class="btn btn--secondary">Tüm Taksileri Gör</a>
        </div>
        @if (nearbyMessage(); as msg) {
          <p class="hero__nearby-note muted">{{ msg }}</p>
        }
      </div>
    </section>

    @if (nearbyRequested()) {
      <section class="container section" aria-labelledby="nearby-heading">
        <h2 id="nearby-heading" class="section-title">Yakınımdaki Taksiler</h2>
        <app-business-list
          [businesses]="nearby.value() ?? []"
          [loading]="nearby.isLoading()"
          emptyTitle="Yakınınızda henüz yayınlanmış işletme yok"
          emptyDescription="Doğrulanmamış bilgi yayınlamıyoruz. Tüm taksileri listeden görebilirsiniz."
        >
          <a routerLink="/taksi" class="btn btn--secondary">Tüm Taksileri Gör</a>
        </app-business-list>
      </section>
    }

    <section class="container section" aria-labelledby="districts-heading">
      <h2 id="districts-heading" class="section-title">Popüler Taksi Bölgeleri</h2>
      @if (districts.isLoading()) {
        <div class="chip-row">
          @for (i of [1, 2, 3, 4, 5]; track i) {
            <app-skeleton height="2.25rem" width="6rem" radius="var(--radius-full)" />
          }
        </div>
      } @else {
        <ul class="chip-row">
          @for (loc of sortedDistricts(); track loc.id) {
            <li>
              <button
                type="button"
                class="chip"
                [class.chip--active]="loc.id === effectiveDistrictId()"
                [attr.aria-pressed]="loc.id === effectiveDistrictId()"
                (click)="selectDistrict(loc.id)"
              >
                {{ loc.name }}
              </button>
            </li>
          }
        </ul>
      }
    </section>

    <section class="container section" aria-labelledby="services-heading">
      <h2 id="services-heading" class="section-title">Hizmetler</h2>
      @if (services.isLoading()) {
        <div class="chip-row">
          @for (i of [1, 2, 3, 4]; track i) {
            <app-skeleton height="2.25rem" width="8rem" radius="var(--radius-full)" />
          }
        </div>
      } @else {
        <ul class="chip-row">
          @for (s of services.value() ?? []; track s.id) {
            <li>
              <a class="chip" [routerLink]="['/hizmet', s.slug]">{{ s.name }}</a>
            </li>
          }
        </ul>
      }
    </section>

    <section class="container section" aria-labelledby="listing-heading">
      <h2 id="listing-heading" class="section-title">{{ listingHeading() }}</h2>
      <app-business-list
        [businesses]="businesses.value() ?? []"
        [loading]="businesses.isLoading()"
        emptyTitle="Rehber henüz hazırlanıyor"
        [emptyDescription]="listingEmptyDescription()"
      >
        <a routerLink="/isletme-ekle" class="btn btn--brand">İşletmemi Yayınla</a>
      </app-business-list>
    </section>

    <section class="container section" aria-labelledby="owner-heading">
      <div class="owner-cta">
        <h2 id="owner-heading" class="section-title">Taksi işletmeniz mi var?</h2>
        <p class="muted">
          İşletmenizi ücretsiz ekleyin, müşterilerin sizi daha kolay bulmasını sağlayın.
        </p>
        <a routerLink="/isletme-ekle" class="btn btn--brand">İşletmemi Yayınla</a>
      </div>
    </section>
  `,
  styles: `
    .hero {
      background: linear-gradient(180deg, var(--c-brand-soft), var(--c-bg));
      border-bottom: 1px solid var(--c-border);
    }

    .hero__inner {
      padding-block: var(--sp-12) var(--sp-10);
      max-width: 42rem;
    }

    .hero__title {
      font-size: var(--fs-3xl);
      letter-spacing: -0.02em;
    }

    .hero__lead {
      margin-block-start: var(--sp-3);
      font-size: var(--fs-lg);
      color: var(--c-text-muted);
    }

    .hero__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-3);
      margin-block-start: var(--sp-6);
    }

    .hero__nearby-note {
      margin-block-start: var(--sp-3);
      font-size: var(--fs-sm);
    }

    .section {
      padding-block-start: var(--sp-10);
    }

    .section-title {
      margin-block-end: var(--sp-4);
    }

    /* .chip / .chip-row: src/styles.css'te global — birden fazla sayfada kullanılıyor */

    .owner-cta {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--sp-3);
      padding: var(--sp-8);
      background-color: var(--c-bg-subtle);
      border: 1px solid var(--c-border);
      border-radius: var(--radius-lg);
    }

    @media (min-width: 768px) {
      .hero__inner {
        padding-block: var(--sp-16) var(--sp-12);
      }

      .hero__title {
        font-size: var(--fs-4xl);
      }
    }
  `,
})
export class HomePage {
  private readonly businessRepo = inject(BusinessRepository);
  private readonly locationRepo = inject(LocationRepository);
  private readonly serviceRepo = inject(ServiceRepository);
  private readonly geolocation = inject(GeolocationService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly analytics = inject(AnalyticsService);

  constructor() {
    this.seo.setPage({
      title: "Kütahya Taksi Ağı — Kütahya'da Taksi Bul",
      description:
        "Kütahya'daki taksi işletmelerini tek yerde keşfedin. Telefon, WhatsApp ve yol tarifi tek tıkla.",
      path: '/',
    });
  }

  protected readonly districts = rxResource({
    stream: () => this.locationRepo.districts(),
  });

  /** Kütahya Merkez (il merkezi) her zaman listenin BAŞINDA ve vurgulu gösterilir. */
  protected readonly sortedDistricts = computed(() => {
    const list = this.districts.value() ?? [];
    return [...list].sort((a, b) => Number(b.slug === 'merkez') - Number(a.slug === 'merkez'));
  });

  /**
   * Kullanıcı bir çip seçmediyse Merkez'e düşer. `undefined` = "districts henüz
   * yüklenmedi, bekle" (rxResource bunu `businesses` isteğini ERTELEMEK için
   * kullanır); `null` = "districts yüklendi ama merkez bulunamadı, TÜMÜNÜ göster"
   * (referans veri bozulursa bile liste sonsuza dek boş kalmasın diye).
   */
  private readonly userSelectedDistrictId = signal<string | undefined>(undefined);
  private readonly merkezId = computed(() => this.districts.value()?.find((l) => l.slug === 'merkez')?.id);
  protected readonly effectiveDistrictId = computed<string | null | undefined>(() => {
    const selected = this.userSelectedDistrictId();
    if (selected) return selected;
    if (this.districts.isLoading()) return undefined;
    return this.merkezId() ?? null;
  });
  protected readonly selectedDistrictName = computed(
    () => this.sortedDistricts().find((l) => l.id === this.effectiveDistrictId())?.name,
  );

  protected readonly listingHeading = computed(() => {
    const name = this.selectedDistrictName();
    return name ? `${name} Taksi İşletmeleri` : "Kütahya'daki Taksi İşletmeleri";
  });

  protected readonly listingEmptyDescription = computed(() => {
    const name = this.selectedDistrictName();
    return name
      ? `${name} bölgesinde henüz yayınlanmış işletme yok. Doğrulanmamış hiçbir numara yayınlanmıyor.`
      : "Kütahya'daki taksi duraklarının bilgilerini doğrulayarak ekliyoruz. Doğrulanmamış hiçbir numara yayınlanmıyor.";
  });

  /**
   * §21/§22 — "Popüler Taksi Bölgeleri" çipleri artık bu listeyi FİLTRELER
   * (sayfa değişmeden); önceden yalnızca `/bolge/:slug`e link veriyordu.
   * O bağımsız sayfa (`/bolge/:slug`, crawlable, `/bolge` index'inden erişilir)
   * hâlâ var — bu, homepage'in kendi içindeki hızlı önizleme deneyimi.
   */
  protected readonly businesses = rxResource({
    params: () => this.effectiveDistrictId(),
    stream: ({ params }) => (params ? this.businessRepo.byLocation(params) : this.businessRepo.list(12)),
  });

  protected selectDistrict(locationId: string): void {
    this.userSelectedDistrictId.set(locationId);
  }

  protected readonly services = rxResource({
    stream: () => this.serviceRepo.list(),
  });

  protected readonly nearbyRequested = signal(false);
  private readonly nearbyCoords = signal<{ latitude: number; longitude: number } | undefined>(
    undefined,
  );
  protected readonly nearbyMessage = signal<string | null>(null);

  protected readonly nearby = rxResource({
    params: () => this.nearbyCoords(),
    stream: ({ params }) => this.businessRepo.nearby(params.latitude, params.longitude),
  });

  /**
   * Konum izni ister; reddedilirse veya alınamazsa Kütahya Merkez'e düşer (§49).
   * Site, izin verilmese de çalışmaya devam eder.
   */
  protected async findNearby(): Promise<void> {
    this.nearbyRequested.set(true);
    const coords = await this.geolocation.requestLocation();

    if (coords) {
      this.nearbyMessage.set(null);
      this.nearbyCoords.set(coords);
      this.analytics.track({
        eventType: 'search_performed',
        metadata: { query_type: 'nearby', geolocation: 'granted' },
      });
    } else {
      this.nearbyMessage.set('Konumunuz alınamadı — Kütahya Merkez baz alınıyor.');
      // Kütahya Merkez koordinatı (bkz. supabase/migrations — OSM doğrulamalı).
      this.nearbyCoords.set({ latitude: 39.41991, longitude: 29.98579 });
      this.analytics.track({
        eventType: 'search_performed',
        metadata: { query_type: 'nearby', geolocation: 'fallback' },
      });
    }

    void this.router.navigate([], { fragment: 'nearby-heading' });
  }
}
