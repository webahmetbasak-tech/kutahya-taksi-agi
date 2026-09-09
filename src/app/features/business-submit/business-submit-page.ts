import { Component, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { form, FormField, validate } from '@angular/forms/signals';
import { BusinessSubmitRepository } from '@core/data/business-submit.repository';
import { BusinessMediaRepository } from '@core/data/business-media.repository';
import { LocationRepository } from '@core/data/location.repository';
import { BusinessMediaService } from '@core/storage/business-media.service';
import { AuthService } from '@core/auth/auth.service';
import { AnalyticsService } from '@core/analytics/analytics.service';
import { SeoService } from '@core/seo/seo.service';
import { normalizeTrPhone } from '@shared/utils/phone';
import { photoErrorMessage } from '@shared/utils/business-media-errors';
import { Skeleton } from '@shared/ui/skeleton';

/**
 * "İşletmemi Yayınla" — `/isletme-ekle` (Faz 8, §26).
 *
 * OTURUM YOKSA `/giris?redirect=/isletme-ekle`e yönlendirir (bkz. `ClaimPage`
 * ile aynı desen). GÜVENLİK TEK YERDE: doğrulama, telefon normalizasyonu, slug
 * üretimi ve olası kopya işaretleme (§52 — otomatik silme/reddetme YOK) tek
 * atomik `submit_business` RPC'sinde yapılır; bu sayfa yalnızca UX'i yönetir.
 *
 * `RenderMode.Client`: oturuma bağlı, noindex, SSR'da render edilmez.
 */
@Component({
  selector: 'app-business-submit-page',
  imports: [RouterLink, FormField, Skeleton],
  template: `
    <div class="container page">
      @if (!auth.ready()) {
        <app-skeleton height="2rem" width="60%" />
        <app-skeleton height="20rem" />
      } @else if (!auth.isAuthenticated()) {
        <p class="lead">Giriş sayfasına yönlendiriliyorsunuz…</p>
      } @else if (submitResult(); as result) {
        <h1 class="page-title">Başvurunuz Alındı</h1>

        <p class="form-banner form-banner--success" role="status">
          <strong>{{ submittedName() }}</strong> başvurunuz alındı ve incelemeye gönderildi.
          Onaylandığında profiliniz yayına girecek.
        </p>

        @if (result.possible_duplicate) {
          <p class="form-banner form-banner--warning" role="status">
            Benzer bir işletme kaydımızda zaten olabilir. Bu bir sorun değil — ekibimiz kontrol
            edip mükerrer kayıtları birleştirecek, başvurunuz kaybolmayacak.
          </p>
        }

        <div class="card photos">
          <h2 class="photos__title">Fotoğraf Ekle (isteğe bağlı)</h2>
          <p class="muted">
            İşletmenizi tanıtan fotoğraflar ekleyin. Erişilebilirlik için her fotoğraf için kısa
            bir açıklama (alt metin) gerekir.
          </p>

          @if (photoError(); as err) {
            <p class="form-banner form-banner--error" role="alert">{{ err }}</p>
          }

          <div class="field">
            <label class="field__label" for="photo-file">Fotoğraf dosyası</label>
            <input
              id="photo-file"
              class="field__input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              (change)="onPhotoSelected($event)"
            />
          </div>

          <div class="field">
            <label class="field__label" for="photo-alt">Görsel açıklaması (alt metin)</label>
            <input
              id="photo-alt"
              class="field__input"
              type="text"
              placeholder="ör. Merkez garajındaki taksi durağı"
              [value]="photoAltText()"
              (input)="photoAltText.set($any($event.target).value)"
            />
          </div>

          <button
            type="button"
            class="btn btn--secondary"
            [disabled]="uploadingPhoto() || !photoFile()"
            (click)="onAddPhoto(result.id)"
          >
            {{ uploadingPhoto() ? 'Yükleniyor…' : 'Fotoğrafı Ekle' }}
          </button>

          @if (photos().length > 0) {
            <ul class="photos__list">
              @for (photo of photos(); track photo.storagePath) {
                <li>✓ {{ photo.altText }}</li>
              }
            </ul>
          }
        </div>

        <a routerLink="/panel" class="btn btn--brand">Panelime Git</a>
      } @else {
        <h1 class="page-title">İşletmemi Yayınla</h1>
        <p class="lead">
          Taksi işletmenizi Kütahya Taksi Ağı'na ücretsiz ekleyin. Başvurunuz incelendikten sonra
          profiliniz yayına girer.
        </p>

        <form class="card" novalidate (submit)="onSubmit($event)">
          @if (errorMessage(); as msg) {
            <p class="form-banner form-banner--error" role="alert">{{ msg }}</p>
          }

          <div class="field">
            <label class="field__label" for="biz-name">İşletme adı</label>
            <input id="biz-name" class="field__input" type="text" [formField]="submitForm.businessName" />
            @if (submitForm.businessName().touched() && submitForm.businessName().errors()[0]; as err) {
              <p class="field__error">{{ err.message }}</p>
            }
          </div>

          <div class="field">
            <label class="field__label" for="biz-phone">Telefon</label>
            <input
              id="biz-phone"
              class="field__input"
              type="tel"
              autocomplete="tel"
              placeholder="0555 111 22 33"
              [formField]="submitForm.phone"
            />
            @if (submitForm.phone().touched() && submitForm.phone().errors()[0]; as err) {
              <p class="field__error">{{ err.message }}</p>
            }
          </div>

          <div class="field">
            <label class="field__label" for="biz-driver-name">Şoför Ad Soyad</label>
            <input id="biz-driver-name" class="field__input" type="text" [formField]="submitForm.driverName" />
          </div>

          <div class="field">
            <span class="field__label">İl</span>
            <p class="field__static">Kütahya</p>
          </div>

          <div class="field">
            <label class="field__label" for="biz-district">İlçe</label>
            <select id="biz-district" class="field__input" [formField]="submitForm.district">
              <option value="">İlçe seçin</option>
              @for (d of districts.value() ?? []; track d.id) {
                <option [value]="d.name">{{ d.name }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label class="field__label" for="biz-address">Durak Adresi</label>
            <input id="biz-address" class="field__input" type="text" [formField]="submitForm.address" />
          </div>

          <div class="field">
            <label class="field__label" for="biz-website">Web sitesi (isteğe bağlı)</label>
            <input
              id="biz-website"
              class="field__input"
              type="text"
              placeholder="ornek.com"
              [formField]="submitForm.website"
            />
          </div>

          <div class="field">
            <label class="field__label" for="biz-description">Açıklama (isteğe bağlı)</label>
            <textarea id="biz-description" class="field__input" rows="4" [formField]="submitForm.description"></textarea>
          </div>

          <button type="submit" class="btn btn--brand btn--block" [disabled]="submitting()">
            {{ submitting() ? 'Gönderiliyor…' : 'Başvuruyu Gönder' }}
          </button>
        </form>
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

    .field__static {
      margin: 0;
      padding-block: var(--sp-2);
      color: var(--c-text-muted);
    }

    .photos {
      margin-block: var(--sp-6);
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }

    .photos__title {
      font-size: var(--fs-lg);
      font-weight: var(--fw-semibold);
    }

    .photos__list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: var(--sp-1);
      font-size: var(--fs-sm);
      color: var(--c-text-muted);
    }
  `,
})
export class BusinessSubmitPage {
  private readonly submitRepo = inject(BusinessSubmitRepository);
  private readonly mediaRepo = inject(BusinessMediaRepository);
  private readonly locationRepo = inject(LocationRepository);
  private readonly mediaService = inject(BusinessMediaService);

  /** İlçe artık elle yazılmıyor — yazım hatası/geçersiz değer riskini kaldırır. */
  protected readonly districts = rxResource({ stream: () => this.locationRepo.districts() });
  protected readonly auth = inject(AuthService);
  private readonly analytics = inject(AnalyticsService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly submitResult = signal<{ id: string; slug: string; possible_duplicate: boolean } | null>(
    null,
  );
  protected readonly submittedName = signal('');

  protected readonly photos = signal<{ storagePath: string; altText: string }[]>([]);
  protected readonly photoFile = signal<File | null>(null);
  protected readonly photoAltText = signal('');
  protected readonly photoError = signal<string | null>(null);
  protected readonly uploadingPhoto = signal(false);

  private readonly submitModel = signal({
    businessName: '',
    phone: '',
    driverName: '',
    address: '',
    district: '',
    website: '',
    description: '',
  });

  protected readonly submitForm = form(this.submitModel, (path) => {
    validate(path.businessName, (ctx) =>
      ctx.value().trim() ? undefined : { kind: 'required', message: 'İşletme adı gerekli.' },
    );
    validate(path.phone, (ctx) => {
      const value = ctx.value().trim();
      if (!value) return undefined;
      return normalizeTrPhone(value)
        ? undefined
        : { kind: 'phone_format', message: 'Geçerli bir telefon numarası girin (ör. 0555 111 22 33).' };
    });
  });

  constructor() {
    effect(() => {
      this.seo.setPage({
        title: 'İşletmemi Yayınla — Kütahya Taksi Ağı',
        description:
          "Taksi işletmenizi Kütahya Taksi Ağı'na ücretsiz ekleyin, profilinizi kendiniz yönetin.",
        path: '/isletme-ekle',
        noindex: true,
      });
    });

    effect(() => {
      if (this.auth.ready() && !this.auth.isAuthenticated()) {
        void this.router.navigate(['/giris'], { queryParams: { redirect: '/isletme-ekle' } });
      }
    });
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.submitForm().markAsTouched();
    if (this.submitForm().errorSummary().length > 0) {
      return;
    }

    const model = this.submitModel();
    const businessName = model.businessName.trim();
    const phone = model.phone.trim();
    const driverName = model.driverName.trim();
    const address = model.address.trim();
    const district = model.district.trim();
    const website = model.website.trim();
    const description = model.description.trim();

    this.errorMessage.set(null);
    this.submitting.set(true);

    this.submitRepo
      .submit({
        p_business_name: businessName,
        ...(phone && { p_phone: normalizeTrPhone(phone) ?? phone }),
        ...(driverName && { p_driver_name: driverName }),
        ...(address && { p_address: address }),
        ...(district && { p_district: district }),
        ...(website && { p_website: website }),
        ...(description && { p_description: description }),
      })
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          this.submittedName.set(businessName);
          this.submitResult.set(result);
          this.analytics.track({ eventType: 'listing_submitted', businessId: result.id });
        },
        error: () => {
          this.submitting.set(false);
          this.errorMessage.set('Başvuru gönderilemedi. Lütfen bilgileri kontrol edip tekrar deneyin.');
        },
      });
  }

  protected onPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.photoError.set(null);
    if (file) {
      const validationError = this.mediaService.validate(file);
      if (validationError) {
        this.photoError.set(validationError);
        this.photoFile.set(null);
        return;
      }
    }
    this.photoFile.set(file);
  }

  protected async onAddPhoto(businessId: string): Promise<void> {
    const file = this.photoFile();
    const altText = this.photoAltText().trim();
    if (!file) return;
    if (!altText) {
      this.photoError.set('Erişilebilirlik için görsel açıklaması (alt metin) girin.');
      return;
    }

    this.photoError.set(null);
    this.uploadingPhoto.set(true);

    const uploadResult = await this.mediaService.upload(businessId, file);
    if ('error' in uploadResult) {
      this.uploadingPhoto.set(false);
      this.photoError.set(uploadResult.error);
      return;
    }

    this.mediaRepo
      .attach({
        business_id: businessId,
        storage_path: uploadResult.storagePath,
        alt_text: altText,
        sort_order: this.photos().length,
      })
      .subscribe({
        next: () => {
          this.uploadingPhoto.set(false);
          this.photos.update((list) => [...list, { storagePath: uploadResult.storagePath, altText }]);
          this.photoFile.set(null);
          this.photoAltText.set('');
        },
        error: (err: unknown) => {
          this.uploadingPhoto.set(false);
          this.photoError.set(photoErrorMessage(err));
        },
      });
  }
}
