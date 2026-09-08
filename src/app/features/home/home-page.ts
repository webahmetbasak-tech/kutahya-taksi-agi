import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyState } from '@shared/ui/empty-state';

/**
 * Ana sayfa (§21, §22).
 *
 * Faz 1 kapsamı: hero, CTA hiyerarşisi ve sayfa iskeleti. Listeleme bölümleri
 * (popüler bölgeler, 7/24 taksiler, havalimanı transferi…) gerçek veriye bağlı
 * olduğu için Faz 3'te doldurulacak — bu fazda uydurma işletme gösterilmez (§20).
 */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink, EmptyState],
  template: `
    <section class="hero">
      <div class="container hero__inner">
        <h1 class="hero__title">Kütahya'da Taksi Bul</h1>
        <p class="hero__lead">Kütahya'daki taksi işletmelerini tek yerde keşfedin.</p>
        <div class="hero__actions">
          <a routerLink="/taksi" class="btn btn--primary">Tüm Taksileri Gör</a>
        </div>
      </div>
    </section>

    <section class="container section" aria-labelledby="listing-heading">
      <h2 id="listing-heading" class="section-title">Kütahya'daki taksi işletmeleri</h2>
      <app-empty-state
        title="Rehber henüz hazırlanıyor"
        description="Kütahya'daki taksi duraklarının bilgilerini doğrulayarak ekliyoruz. Doğrulanmamış hiçbir numara yayınlanmıyor."
      >
        <a routerLink="/isletme-ekle" class="btn btn--brand">İşletmemi Yayınla</a>
      </app-empty-state>
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

    .section {
      padding-block-start: var(--sp-10);
    }

    .section-title {
      margin-block-end: var(--sp-4);
    }

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
export class HomePage {}
