import { Component, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { form, FormField, validate } from '@angular/forms/signals';
import { BusinessRepository } from '@core/data/business.repository';
import { RemovalRequestRepository } from '@core/data/removal-request.repository';
import { SeoService } from '@core/seo/seo.service';
import { Skeleton } from '@shared/ui/skeleton';

/**
 * "Bu profilin kaldırılmasını talep et" — `/taksi/:slug/kaldirma-talebi`
 * (Faz 9c, KVKK, §56).
 *
 * BİLEREK oturum GEREKTİRMEZ (`ClaimPage`/`BusinessSubmitPage`nin aksine) —
 * numarası kamuya açık paylaşılmış bir taksicinin hesabı hiç olmayabilir,
 * kaldırma talep etmek için hesap açmaya zorlanmamalı.
 *
 * `RenderMode.Client`: kimlik doğrulama gerektirmez ama SEO'ya konu değildir
 * (noindex — bu bir "profil" sayfası değil, bir form).
 */
@Component({
  selector: 'app-removal-request-page',
  imports: [RouterLink, FormField, Skeleton],
  template: `
    <div class="container page">
      @if (business.isLoading()) {
        <app-skeleton height="2rem" width="60%" />
        <app-skeleton height="8rem" />
      } @else if (business.value(); as b) {
        @if (submitted()) {
          <h1 class="page-title">Talebiniz Alındı</h1>
          <p class="form-banner form-banner--success" role="status">
            <strong>{{ b.business_name }}</strong> profili için kaldırma talebiniz ekibimize
            iletildi. İnceleyip size dönüş yapabiliriz.
          </p>
          <a routerLink="/taksi" class="btn btn--secondary">Tüm Taksileri Gör</a>
        } @else {
          <h1 class="page-title">{{ b.business_name }} — Kaldırma Talebi</h1>
          <p class="lead">
            Bu profilin kaldırılmasını mı istiyorsunuz? Numaranızın veya bilgilerinizin kamuya
            açık paylaşılmasını istemiyorsanız, aşağıdaki formu doldurun — ekibimiz inceleyip
            hızlıca kaldırır.
          </p>

          <form class="card" novalidate (submit)="onSubmit($event, b.id)">
            @if (errorMessage(); as msg) {
              <p class="form-banner form-banner--error" role="alert">{{ msg }}</p>
            }

            <div class="field">
              <label class="field__label" for="removal-reason">Sebep</label>
              <textarea
                id="removal-reason"
                class="field__input"
                rows="4"
                placeholder="ör. Bu benim işletmem ve numaramın burada olmasını istemiyorum."
                [formField]="removalForm.reason"
              ></textarea>
              @if (removalForm.reason().touched() && removalForm.reason().errors()[0]; as err) {
                <p class="field__error">{{ err.message }}</p>
              }
            </div>

            <div class="field">
              <label class="field__label" for="removal-email">E-posta (isteğe bağlı)</label>
              <input
                id="removal-email"
                class="field__input"
                type="email"
                placeholder="size dönüş yapabilmemiz için"
                [formField]="removalForm.contactEmail"
              />
            </div>

            <button type="submit" class="btn btn--brand btn--block" [disabled]="submitting()">
              {{ submitting() ? 'Gönderiliyor…' : 'Kaldırma Talebi Gönder' }}
            </button>
          </form>
        }
      } @else {
        <h1 class="page-title">İşletme bulunamadı</h1>
        <a routerLink="/taksi" class="btn btn--secondary">Tüm Taksileri Gör</a>
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
  `,
})
export class RemovalRequestPage {
  private readonly businessRepo = inject(BusinessRepository);
  private readonly removalRepo = inject(RemovalRequestRepository);
  private readonly seo = inject(SeoService);

  readonly slug = input.required<string>();

  protected readonly business = rxResource({
    params: () => this.slug(),
    stream: ({ params }) => this.businessRepo.bySlug(params),
  });

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly removalModel = signal({ reason: '', contactEmail: '' });
  protected readonly removalForm = form(this.removalModel, (path) => {
    validate(path.reason, (ctx) =>
      ctx.value().trim() ? undefined : { kind: 'required', message: 'Sebep gerekli.' },
    );
  });

  constructor() {
    effect(() => {
      this.seo.setPage({
        title: 'Kaldırma Talebi — Kütahya Taksi Ağı',
        description: 'Profil kaldırma talebi.',
        path: `/taksi/${this.slug()}/kaldirma-talebi`,
        noindex: true,
      });
    });
  }

  protected onSubmit(event: Event, businessId: string): void {
    event.preventDefault();
    this.removalForm().markAsTouched();
    if (this.removalForm().errorSummary().length > 0) {
      return;
    }

    const model = this.removalModel();
    this.errorMessage.set(null);
    this.submitting.set(true);

    this.removalRepo
      .request({
        p_business_id: businessId,
        p_reason: model.reason.trim(),
        ...(model.contactEmail.trim() && { p_contact_email: model.contactEmail.trim() }),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.submitted.set(true);
        },
        error: () => {
          this.submitting.set(false);
          this.errorMessage.set('Talep gönderilemedi. Lütfen tekrar deneyin.');
        },
      });
  }
}
