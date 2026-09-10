import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BusinessRepository } from '@core/data/business.repository';
import { LocationRepository } from '@core/data/location.repository';
import { ServiceRepository } from '@core/data/service.repository';
import { BusinessList } from '@shared/components/business-list';
import { Skeleton } from '@shared/ui/skeleton';
import { SeoService } from '@core/seo/seo.service';

/**
 * Ana sayfa (§21, §22).
 *
 * Bölüm sırası: Video Hero → Popüler Bölgeler → Hizmetler → İşletmeler →
 * İşletme sahipleri CTA'sı. "Yakınımdaki Taksiler" (§49, konum izni tabanlı)
 * BİLEREK kaldırıldı — bölge/hizmet filtresi aynı ihtiyacı sayfa değişmeden
 * karşılıyor, konum izni istemeden. Prompt §22'deki "7/24 taksiler",
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
      <video class="hero__video" autoplay muted loop playsinline poster="/hero-poster.jpg">
        <source src="/hero.mp4" type="video/mp4" />
      </video>
      <div class="hero__scrim"></div>
      <div class="container hero__inner">
        <h1 class="hero__title">Kütahya'da Taksi Bul</h1>
        <p class="hero__lead">Kütahya'daki taksi işletmelerini tek yerde keşfedin.</p>
      </div>
    </section>

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
              <button
                type="button"
                class="chip"
                [class.chip--active]="s.id === selectedServiceId()"
                [attr.aria-pressed]="s.id === selectedServiceId()"
                (click)="selectService(s.id)"
              >
                {{ s.name }}
              </button>
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
      position: relative;
      overflow: hidden;
      min-height: 22rem;
      display: flex;
      align-items: flex-end;
      background-color: var(--c-text); /* video/poster yüklenene kadarki koyu zemin */
    }

    .hero__video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .hero__scrim {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgb(0 0 0 / 25%), rgb(0 0 0 / 65%));
    }

    @media (prefers-reduced-motion: reduce) {
      .hero__video {
        display: none;
      }

      .hero {
        background-image: url('/hero-poster.jpg');
        background-size: cover;
        background-position: center;
      }
    }

    .hero__inner {
      position: relative;
      padding-block: var(--sp-12) var(--sp-10);
      max-width: 42rem;
    }

    .hero__title {
      font-size: var(--fs-3xl);
      letter-spacing: -0.02em;
      color: var(--c-text-inverse);
    }

    .hero__lead {
      margin-block-start: var(--sp-3);
      font-size: var(--fs-lg);
      color: var(--c-text-inverse);
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
  private readonly seo = inject(SeoService);

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

  protected readonly services = rxResource({
    stream: () => this.serviceRepo.list(),
  });

  /** Hizmet filtresi isteğe bağlıdır — varsayılan olarak hiçbiri seçili değildir (Bölge'nin aksine). */
  protected readonly selectedServiceId = signal<string | undefined>(undefined);
  protected readonly selectedServiceName = computed(
    () => (this.services.value() ?? []).find((s) => s.id === this.selectedServiceId())?.name,
  );

  protected readonly listingHeading = computed(() => {
    const district = this.selectedDistrictName();
    const service = this.selectedServiceName();
    const base = district ? `${district} Taksi İşletmeleri` : "Kütahya'daki Taksi İşletmeleri";
    return service ? `${base} — ${service}` : base;
  });

  protected readonly listingEmptyDescription = computed(() => {
    const district = this.selectedDistrictName();
    const service = this.selectedServiceName();
    if (district && service) {
      return `${district} bölgesinde "${service}" hizmeti veren yayınlanmış işletme yok. Doğrulanmamış hiçbir numara yayınlanmıyor.`;
    }
    if (district) {
      return `${district} bölgesinde henüz yayınlanmış işletme yok. Doğrulanmamış hiçbir numara yayınlanmıyor.`;
    }
    return "Kütahya'daki taksi duraklarının bilgilerini doğrulayarak ekliyoruz. Doğrulanmamış hiçbir numara yayınlanmıyor.";
  });

  /**
   * §21/§22 — "Popüler Taksi Bölgeleri" VE "Hizmetler" çipleri artık BİRLİKTE bu
   * listeyi FİLTRELER (sayfa değişmeden): bölge zorunlu/varsayılan (Merkez),
   * hizmet isteğe bağlı bir ek daraltmadır. Önceden ikisi de yalnızca ilgisiz
   * `/bolge/:slug`/`/hizmet/:slug`e link veriyordu — "Bölge X seçiliyken Hizmet
   * Y'ye tıklayınca X'le hiç ilgisi olmayan sonuçlar görünmesi" kafa karıştırıcıydı.
   * O bağımsız sayfalar (`/bolge/:slug`, `/hizmet/:slug`, crawlable, ilgili index
   * sayfalarından erişilir) hâlâ var — bu, homepage'in kendi içindeki hızlı
   * önizleme deneyimi.
   */
  protected readonly businesses = rxResource({
    params: () => {
      const districtId = this.effectiveDistrictId();
      if (districtId === undefined) return undefined; // districts henüz yüklenmedi, bekle
      return { districtId, serviceId: this.selectedServiceId() };
    },
    stream: ({ params }) => {
      const { districtId, serviceId } = params;
      if (districtId && serviceId) {
        return this.businessRepo.forLandingPage({ locationId: districtId, serviceId });
      }
      if (districtId) return this.businessRepo.byLocation(districtId);
      if (serviceId) return this.businessRepo.byService(serviceId);
      return this.businessRepo.list(12);
    },
  });

  protected selectDistrict(locationId: string): void {
    this.userSelectedDistrictId.set(locationId);
  }

  protected selectService(serviceId: string): void {
    this.selectedServiceId.update((current) => (current === serviceId ? undefined : serviceId));
  }
}
