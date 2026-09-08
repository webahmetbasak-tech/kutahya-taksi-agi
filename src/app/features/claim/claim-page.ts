import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { form, FormField, validate } from '@angular/forms/signals';
import { BusinessRepository } from '@core/data/business.repository';
import { ClaimRepository } from '@core/data/claim.repository';
import { AuthService } from '@core/auth/auth.service';
import { AnalyticsService } from '@core/analytics/analytics.service';
import { SeoService } from '@core/seo/seo.service';
import { normalizeTrPhone } from '@shared/utils/phone';
import { Skeleton } from '@shared/ui/skeleton';

/**
 * "Bu işletme size mi ait?" akışı — `/taksi/:slug/sahiplen` (Faz 7, §14).
 *
 * OTURUM YOKSA `/giris?redirect=/taksi/:slug/sahiplen`e yönlendirir; giriş
 * sonrası kullanıcı BURAYA geri döner (bkz. `AuthPage.navigateAfterAuth()`).
 *
 * GÜVENLİK TEK YERDE: bu sayfa "işletme zaten sahiplenilmiş mi" gibi kuralları
 * TEKRARLAMAZ — `claims_insert_own` RLS politikası veritabanında zorunlu kılar
 * (bkz. `ClaimRepository` yorumu). Sayfa yalnızca UX için kullanıcının KENDİ
 * bu işletmeye dair en son talebini gösterir (pending/approved/rejected).
 *
 * `RenderMode.Client`: oturuma bağlı, noindex, SSR'da render edilmez.
 */
@Component({
  selector: 'app-claim-page',
  imports: [RouterLink, FormField, Skeleton],
  template: `
    <div class="container page">
      @if (!auth.ready() || business.isLoading() || (auth.isAuthenticated() && myClaims.isLoading())) {
        <app-skeleton height="2rem" width="60%" />
        <app-skeleton height="8rem" />
      } @else if (!auth.isAuthenticated()) {
        <p class="lead">Giriş sayfasına yönlendiriliyorsunuz…</p>
      } @else if (business.value() === null) {
        <h1 class="page-title">İşletme bulunamadı</h1>
        <p class="lead">
          <code class="slug">{{ slug() }}</code> adresinde yayınlanmış bir taksi işletmesi yok.
        </p>
        <a routerLink="/taksi" class="btn btn--secondary">Tüm Taksileri Gör</a>
      } @else {
        <h1 class="page-title">{{ businessName() }}'ı Sahiplen</h1>

        @switch (latestClaimStatus()) {
          @case ('pending') {
            <p class="form-banner form-banner--info" role="status">
              Talebiniz alındı ve inceleniyor. Ekibimiz sizinle iletişime geçecek.
            </p>
          }
          @case ('approved') {
            <p class="form-banner form-banner--success" role="status">
              Bu işletmeyi zaten sahiplendiniz. Bilgilerinizi panelinizden yönetebilirsiniz.
            </p>
            <a routerLink="/panel" class="btn btn--brand">Panelime Git</a>
          }
          @default {
            <p class="lead">
              Bu profilin sahibi olduğunuzu doğrulamak için iletişim telefonunuzu bırakın. Ekibimiz
              sizi arayarak doğrulayacak (§ manuel doğrulama — MVP'de otomatik SMS/OTP yok).
            </p>

            <form class="card" novalidate (submit)="onSubmit($event)">
              @if (errorMessage(); as msg) {
                <p class="form-banner form-banner--error" role="alert">{{ msg }}</p>
              }

              <div class="field">
                <label class="field__label" for="claim-phone">Telefon numaranız</label>
                <input
                  id="claim-phone"
                  class="field__input"
                  type="tel"
                  autocomplete="tel"
                  placeholder="0555 111 22 33"
                  [formField]="claimForm.phone"
                />
                @if (claimForm.phone().touched() && claimForm.phone().errors()[0]; as err) {
                  <p class="field__error">{{ err.message }}</p>
                }
              </div>

              <div class="field">
                <label class="field__label" for="claim-note">Not (isteğe bağlı)</label>
                <textarea
                  id="claim-note"
                  class="field__input"
                  rows="3"
                  placeholder="Sahipliğinizi doğrulamamıza yardımcı olacak ek bilgi…"
                  [formField]="claimForm.note"
                ></textarea>
              </div>

              <button type="submit" class="btn btn--brand btn--block" [disabled]="submitting()">
                {{ submitting() ? 'Gönderiliyor…' : 'Sahiplenme Talebi Gönder' }}
              </button>
            </form>
          }
        }
      }
    </div>
  `,
  styles: `
    .page {
      padding-block: var(--sp-8) var(--sp-12);
      max-width: 32rem;
    }

    .lead {
      margin-block: var(--sp-2) var(--sp-6);
    }

    form.card {
      display: flex;
      flex-direction: column;
    }

    form.card > * + * {
      margin-block-start: var(--sp-4);
    }

    textarea.field__input {
      resize: vertical;
      font-family: inherit;
    }

    .slug {
      padding: var(--sp-1) var(--sp-2);
      background-color: var(--c-bg-muted);
      border-radius: var(--radius-sm);
      font-size: var(--fs-sm);
    }
  `,
})
export class ClaimPage {
  private readonly businessRepo = inject(BusinessRepository);
  private readonly claimRepo = inject(ClaimRepository);
  protected readonly auth = inject(AuthService);
  private readonly analytics = inject(AnalyticsService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  readonly slug = input.required<string>();

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly business = rxResource({
    params: () => this.slug(),
    stream: ({ params }) => this.businessRepo.bySlug(params),
  });

  protected readonly businessName = computed(() => this.business.value()?.business_name ?? null);
  private readonly businessId = computed(() => this.business.value()?.id);

  private readonly claimsQueryUserId = computed(() =>
    this.auth.ready() && this.auth.isAuthenticated() ? this.auth.user()?.id : undefined,
  );

  protected readonly myClaims = rxResource({
    params: () => this.claimsQueryUserId(),
    stream: ({ params }) => this.claimRepo.mine(params),
  });

  /** Bu işletmeye dair kullanıcının en son talebi — talepler zaten submitted_at.desc sıralı gelir. */
  protected readonly latestClaimStatus = computed(() => {
    const bizId = this.businessId();
    if (!bizId) return undefined;
    return this.myClaims.value()?.find((c) => c.business_id === bizId)?.status;
  });

  private readonly claimModel = signal({ phone: '', note: '' });
  protected readonly claimForm = form(this.claimModel, (path) => {
    validate(path.phone, (ctx) => {
      const value = ctx.value().trim();
      if (!value) {
        return { kind: 'required', message: 'Telefon numarası gerekli (doğrulama için).' };
      }
      return normalizeTrPhone(value)
        ? undefined
        : { kind: 'phone_format', message: 'Geçerli bir telefon numarası girin (ör. 0555 111 22 33).' };
    });
  });

  private hasTrackedClaimStarted = false;

  constructor() {
    effect(() => {
      this.seo.setPage({
        title: 'İşletmemi Sahiplen — Kütahya Taksi Ağı',
        description: 'İşletme profilinizi ücretsiz sahiplenin ve bilgilerinizi kendiniz yönetin.',
        path: `/taksi/${this.slug()}/sahiplen`,
        noindex: true,
      });
    });

    effect(() => {
      if (this.auth.ready() && !this.auth.isAuthenticated()) {
        void this.router.navigate(['/giris'], {
          queryParams: { redirect: `/taksi/${this.slug()}/sahiplen` },
        });
      }
    });

    // `claim_started`: yalnızca form GERÇEKTEN gösterildiğinde bir kez sayılır
    // (zaten sahiplenilmiş/pending durumunda form hiç görünmez — bu bir "başlangıç" değildir).
    effect(() => {
      const bizId = this.businessId();
      const status = this.latestClaimStatus();
      if (!this.hasTrackedClaimStarted && bizId && status === undefined && this.myClaims.status() === 'resolved') {
        this.hasTrackedClaimStarted = true;
        this.analytics.track({ eventType: 'claim_started', businessId: bizId });
      }
    });
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.claimForm().markAsTouched();
    if (this.claimForm().errorSummary().length > 0) {
      return;
    }

    const bizId = this.businessId();
    const userId = this.auth.user()?.id;
    if (!bizId || !userId) {
      return;
    }

    const { phone, note } = this.claimModel();
    const normalizedPhone = normalizeTrPhone(phone.trim());

    this.errorMessage.set(null);
    this.submitting.set(true);

    this.claimRepo
      .submit({
        businessId: bizId,
        userId,
        contactPhoneE164: normalizedPhone,
        note: note.trim() || null,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.analytics.track({ eventType: 'claim_completed', businessId: bizId });
          this.myClaims.reload();
        },
        error: () => {
          this.submitting.set(false);
          this.errorMessage.set(
            'Talep gönderilemedi. Bu işletme başka biri tarafından zaten sahiplenilmiş olabilir; ' +
              'sorun devam ederse bizimle iletişime geçin.',
          );
        },
      });
  }
}
