import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { form, FormField, validate } from '@angular/forms/signals';
import { AdminBusinessRepository } from '@core/data/admin-business.repository';
import { SeoService } from '@core/seo/seo.service';
import { normalizeTrPhone } from '@shared/utils/phone';

/**
 * `/admin/hizli-ekle` — hızlı veri girişi (Faz 9a, §51).
 *
 * `submit_business`den (Faz 8) FARKI: sahip yok, onay kuyruğu yok — kaydedilir
 * kaydedilmez `status='active'` (admin'in kendi girdiği kaynak veriye güvenilir,
 * bkz. `admin_quick_add_business` migration yorumu).
 */
@Component({
  selector: 'app-admin-quick-add-page',
  imports: [RouterLink, FormField],
  template: `
    <h1 class="page-title">Hızlı Veri Girişi</h1>
    <p class="lead">Ekip tarafından toplanan işletme bilgisini doğrudan yayına ekleyin.</p>

    @if (result(); as r) {
      <p class="form-banner form-banner--success" role="status">
        <strong>{{ savedName() }}</strong> eklendi ve yayında.
      </p>
      <div class="actions">
        <a [routerLink]="['/admin/isletmeler', r.id]" class="btn btn--brand">İşletmeyi Gör</a>
        <button type="button" class="btn btn--secondary" (click)="reset()">Yeni Ekle</button>
      </div>
    } @else {
      <form class="card" novalidate (submit)="onSubmit($event)">
        @if (errorMessage(); as msg) {
          <p class="form-banner form-banner--error" role="alert">{{ msg }}</p>
        }

        <div class="field">
          <label class="field__label" for="qa-name">İşletme adı</label>
          <input id="qa-name" class="field__input" type="text" [formField]="quickForm.businessName" />
          @if (quickForm.businessName().touched() && quickForm.businessName().errors()[0]; as err) {
            <p class="field__error">{{ err.message }}</p>
          }
        </div>

        <div class="field">
          <label class="field__label" for="qa-phone">Telefon</label>
          <input
            id="qa-phone"
            class="field__input"
            type="tel"
            placeholder="0555 111 22 33"
            [formField]="quickForm.phone"
          />
          @if (quickForm.phone().touched() && quickForm.phone().errors()[0]; as err) {
            <p class="field__error">{{ err.message }}</p>
          }
        </div>

        <div class="field">
          <label class="field__label" for="qa-whatsapp">WhatsApp (isteğe bağlı)</label>
          <input id="qa-whatsapp" class="field__input" type="tel" [formField]="quickForm.whatsapp" />
          @if (quickForm.whatsapp().touched() && quickForm.whatsapp().errors()[0]; as err) {
            <p class="field__error">{{ err.message }}</p>
          }
        </div>

        <div class="field">
          <label class="field__label" for="qa-address">Adres</label>
          <input id="qa-address" class="field__input" type="text" [formField]="quickForm.address" />
        </div>

        <div class="field">
          <label class="field__label" for="qa-district">İlçe</label>
          <input id="qa-district" class="field__input" type="text" [formField]="quickForm.district" />
        </div>

        <div class="field">
          <label class="field__label" for="qa-neighborhood">Mahalle</label>
          <input
            id="qa-neighborhood"
            class="field__input"
            type="text"
            [formField]="quickForm.neighborhood"
          />
        </div>

        <div class="field">
          <label class="field__label" for="qa-website">Web sitesi (isteğe bağlı)</label>
          <input id="qa-website" class="field__input" type="text" [formField]="quickForm.website" />
        </div>

        <div class="field">
          <label class="field__label" for="qa-description">Açıklama (isteğe bağlı)</label>
          <textarea id="qa-description" class="field__input" rows="3" [formField]="quickForm.description"></textarea>
        </div>

        <button type="submit" class="btn btn--brand btn--block" [disabled]="submitting()">
          {{ submitting() ? 'Ekleniyor…' : 'Ekle ve Yayınla' }}
        </button>
      </form>
    }
  `,
  styles: `
    .lead {
      margin-block: var(--sp-2) var(--sp-6);
    }

    form.card {
      display: flex;
      flex-direction: column;
      max-width: 32rem;
    }

    form.card > * + * {
      margin-block-start: var(--sp-4);
    }

    textarea.field__input {
      resize: vertical;
      font-family: inherit;
    }

    .actions {
      display: flex;
      gap: var(--sp-3);
    }
  `,
})
export class AdminQuickAddPage {
  private readonly repo = inject(AdminBusinessRepository);
  private readonly seo = inject(SeoService);

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly result = signal<{ id: string; slug: string } | null>(null);
  protected readonly savedName = signal('');

  private readonly quickModel = signal({
    businessName: '',
    phone: '',
    whatsapp: '',
    address: '',
    district: '',
    neighborhood: '',
    website: '',
    description: '',
  });

  protected readonly quickForm = form(this.quickModel, (path) => {
    validate(path.businessName, (ctx) =>
      ctx.value().trim() ? undefined : { kind: 'required', message: 'İşletme adı gerekli.' },
    );
    validate(path.phone, (ctx) => {
      const value = ctx.value().trim();
      if (!value) return undefined;
      return normalizeTrPhone(value)
        ? undefined
        : { kind: 'phone_format', message: 'Geçerli bir telefon numarası girin.' };
    });
    validate(path.whatsapp, (ctx) => {
      const value = ctx.value().trim();
      if (!value) return undefined;
      return normalizeTrPhone(value)
        ? undefined
        : { kind: 'phone_format', message: 'Geçerli bir telefon numarası girin.' };
    });
  });

  constructor() {
    this.seo.setPage({
      title: 'Hızlı Veri Girişi — Yönetim Paneli',
      description: 'Admin paneli.',
      path: '/admin/hizli-ekle',
      noindex: true,
    });
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.quickForm().markAsTouched();
    if (this.quickForm().errorSummary().length > 0) {
      return;
    }

    const model = this.quickModel();
    const businessName = model.businessName.trim();
    const phone = model.phone.trim();
    const whatsapp = model.whatsapp.trim();
    const address = model.address.trim();
    const district = model.district.trim();
    const neighborhood = model.neighborhood.trim();
    const website = model.website.trim();
    const description = model.description.trim();

    this.errorMessage.set(null);
    this.submitting.set(true);

    this.repo
      .quickAdd({
        p_business_name: businessName,
        ...(phone && { p_phone: normalizeTrPhone(phone) ?? phone }),
        ...(whatsapp && { p_whatsapp: normalizeTrPhone(whatsapp) ?? whatsapp }),
        ...(address && { p_address: address }),
        ...(district && { p_district: district }),
        ...(neighborhood && { p_neighborhood: neighborhood }),
        ...(website && { p_website: website }),
        ...(description && { p_description: description }),
      })
      .subscribe({
        next: (r) => {
          this.submitting.set(false);
          this.savedName.set(businessName);
          this.result.set(r);
        },
        error: () => {
          this.submitting.set(false);
          this.errorMessage.set('Eklenemedi. Bilgileri kontrol edip tekrar deneyin.');
        },
      });
  }

  protected reset(): void {
    this.result.set(null);
    this.quickModel.set({
      businessName: '',
      phone: '',
      whatsapp: '',
      address: '',
      district: '',
      neighborhood: '',
      website: '',
      description: '',
    });
  }
}
