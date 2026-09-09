import { Component, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NgOptimizedImage } from '@angular/common';
import { BusinessMediaRepository } from '@core/data/business-media.repository';
import { BusinessMediaService } from '@core/storage/business-media.service';
import type { BusinessPlan } from '@core/data/models';
import { photoErrorMessage } from '@shared/utils/business-media-errors';

const FREE_PHOTO_LIMIT = 3;

/**
 * İşletme sahibinin kendi fotoğraflarını yönetmesi (Faz 10, §58) —
 * `DashboardPage`den ayrı, küçük ve tek sorumluluklu bir bileşen.
 *
 * Sayı sınırı istemcide TEKRARLANMAZ (bkz. `business_media_enforce_limit`
 * trigger'ı) — buradaki "X/3 kullanıldı" göstergesi yalnızca bilgilendirme,
 * gerçek sınır sunucuda.
 */
@Component({
  selector: 'app-business-photo-manager',
  imports: [NgOptimizedImage],
  template: `
    <div class="manager">
      @if (plan() === 'free') {
        <p class="muted limit-note">
          Ücretsiz planda {{ FREE_PHOTO_LIMIT }} fotoğrafa kadar ekleyebilirsiniz
          ({{ (photos.value() ?? []).length }}/{{ FREE_PHOTO_LIMIT }} kullanıldı).
        </p>
      } @else {
        <p class="muted limit-note">Planınızda sınırsız fotoğraf ekleyebilirsiniz.</p>
      }

      @if (errorMessage(); as err) {
        <p class="form-banner form-banner--error" role="alert">{{ err }}</p>
      }

      @if ((photos.value() ?? []).length > 0) {
        <ul class="photo-grid">
          @for (photo of photos.value() ?? []; track photo.id) {
            <li class="photo-grid__item">
              <img [ngSrc]="photo.storage_path" [alt]="photo.alt_text ?? ''" fill sizes="8rem" />
              <button
                type="button"
                class="photo-grid__remove"
                [attr.aria-label]="'Fotoğrafı sil: ' + (photo.alt_text ?? '')"
                [disabled]="removingId() === photo.id"
                (click)="remove(photo.id, photo.storage_path)"
              >
                ✕
              </button>
            </li>
          }
        </ul>
      }

      <div class="field">
        <label class="visually-hidden" [attr.for]="'photo-file-' + businessId()">Fotoğraf dosyası</label>
        <input
          [id]="'photo-file-' + businessId()"
          class="field__input"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          (change)="onFileSelected($event)"
        />
      </div>

      <div class="field">
        <label class="visually-hidden" [attr.for]="'photo-alt-' + businessId()">Görsel açıklaması</label>
        <input
          [id]="'photo-alt-' + businessId()"
          class="field__input"
          type="text"
          placeholder="Görsel açıklaması (alt metin)"
          [value]="altText()"
          (input)="altText.set($any($event.target).value)"
        />
      </div>

      <button
        type="button"
        class="btn btn--secondary"
        [disabled]="uploading() || !selectedFile()"
        (click)="upload()"
      >
        {{ uploading() ? 'Yükleniyor…' : 'Fotoğraf Ekle' }}
      </button>
    </div>
  `,
  styles: `
    .manager {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      margin-block-start: var(--sp-3);
      padding-block-start: var(--sp-3);
      border-top: 1px solid var(--c-border);
    }

    .limit-note {
      font-size: var(--fs-sm);
    }

    .photo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(6rem, 1fr));
      gap: var(--sp-2);
      list-style: none;
    }

    .photo-grid__item {
      position: relative;
      aspect-ratio: 1;
      border-radius: var(--radius-md);
      overflow: hidden;
      background-color: var(--c-bg-muted);
    }

    .photo-grid__item img {
      object-fit: cover;
    }

    .photo-grid__remove {
      position: absolute;
      top: var(--sp-1);
      right: var(--sp-1);
      min-width: 1.75rem;
      min-height: 1.75rem;
      border-radius: var(--radius-full);
      background-color: var(--c-surface);
      border: 1px solid var(--c-border);
      line-height: 1;
    }
  `,
})
export class BusinessPhotoManager {
  private readonly mediaRepo = inject(BusinessMediaRepository);
  private readonly mediaService = inject(BusinessMediaService);

  readonly businessId = input.required<string>();
  readonly plan = input.required<BusinessPlan>();

  protected readonly FREE_PHOTO_LIMIT = FREE_PHOTO_LIMIT;

  protected readonly photos = rxResource({
    params: () => this.businessId(),
    stream: ({ params }) => this.mediaRepo.forBusiness(params),
  });

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly altText = signal('');
  protected readonly uploading = signal(false);
  protected readonly removingId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  protected onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.errorMessage.set(null);
    if (file) {
      const validationError = this.mediaService.validate(file);
      if (validationError) {
        this.errorMessage.set(validationError);
        this.selectedFile.set(null);
        return;
      }
    }
    this.selectedFile.set(file);
  }

  protected async upload(): Promise<void> {
    const file = this.selectedFile();
    const altText = this.altText().trim();
    if (!file) return;
    if (!altText) {
      this.errorMessage.set('Erişilebilirlik için görsel açıklaması (alt metin) girin.');
      return;
    }

    this.errorMessage.set(null);
    this.uploading.set(true);

    const uploadResult = await this.mediaService.upload(this.businessId(), file);
    if ('error' in uploadResult) {
      this.uploading.set(false);
      this.errorMessage.set(uploadResult.error);
      return;
    }

    this.mediaRepo
      .attach({
        business_id: this.businessId(),
        storage_path: uploadResult.storagePath,
        alt_text: altText,
        sort_order: (this.photos.value() ?? []).length,
      })
      .subscribe({
        next: () => {
          this.uploading.set(false);
          this.selectedFile.set(null);
          this.altText.set('');
          this.photos.reload();
        },
        error: (err: unknown) => {
          this.uploading.set(false);
          this.errorMessage.set(photoErrorMessage(err));
        },
      });
  }

  protected remove(mediaId: string, storagePath: string): void {
    this.errorMessage.set(null);
    this.removingId.set(mediaId);

    this.mediaRepo.remove(mediaId).subscribe({
      next: async () => {
        await this.mediaService.remove(storagePath);
        this.removingId.set(null);
        this.photos.reload();
      },
      error: () => {
        this.removingId.set(null);
        this.errorMessage.set('Fotoğraf silinemedi. Lütfen tekrar deneyin.');
      },
    });
  }
}
