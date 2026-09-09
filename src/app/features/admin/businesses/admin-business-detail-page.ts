import { Component, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { form, FormField, validate } from '@angular/forms/signals';
import { AdminBusinessRepository } from '@core/data/admin-business.repository';
import { AdminLocationRepository } from '@core/data/admin-location.repository';
import { AdminServiceRepository } from '@core/data/admin-service.repository';
import type { AdminBusinessRow, BusinessPlan, BusinessStatus } from '@core/data/models';
import { SeoService } from '@core/seo/seo.service';
import { normalizeTrPhone } from '@shared/utils/phone';
import { Skeleton } from '@shared/ui/skeleton';

const STATUS_LABELS: Record<BusinessStatus, string> = {
  pending: 'İnceleniyor',
  active: 'Yayında',
  suspended: 'Askıda',
  rejected: 'Reddedildi',
  archived: 'Kaldırıldı',
};

/**
 * `/admin/isletmeler/:id` — tek işletme: durum geçişleri, olası-kopya kararı,
 * alan düzenleme (Faz 9a).
 *
 * Durum geçişleri ve kopya işaretini kaldırma DOĞRUDAN `businesses_admin_all`
 * RLS'ine güvenir (RPC değil) — burada `claims_status_timestamps` gibi
 * çok kolonlu bir CHECK kısıtı yok, tek kolonluk bir PATCH yeterli ve doğru.
 */
@Component({
  selector: 'app-admin-business-detail-page',
  imports: [RouterLink, FormField, Skeleton],
  template: `
    <a routerLink="/admin/isletmeler" class="back-link">← İşletmeler</a>

    @if (business.isLoading()) {
      <app-skeleton height="2rem" width="50%" />
      <app-skeleton height="12rem" />
    } @else if (business.value(); as b) {
      <h1 class="page-title">{{ b.business_name }}</h1>
      <span class="badge" [class]="'badge--' + (b.status === 'active' ? 'verified' : 'warning')">
        {{ statusLabel(b.status) }}
      </span>

      @if (actionError(); as err) {
        <p class="form-banner form-banner--error" role="alert">{{ err }}</p>
      }

      @if (b.possible_duplicate_of; as dupId) {
        <div class="card duplicate-banner">
          <p>
            <strong>Olası kopya işareti var.</strong> Benzer isim/telefonla eşleşen
            <a [routerLink]="['/admin/isletmeler', dupId]">başka bir kayıt</a> bulundu.
          </p>
          <div class="actions">
            <button type="button" class="btn btn--secondary" (click)="dismissDuplicate(b.id)">
              Kopya değil, işareti kaldır
            </button>
            <button type="button" class="btn btn--secondary" (click)="reject(b.id)">
              Kopya, reddet
            </button>
          </div>
        </div>
      }

      <div class="card status-actions">
        <h2 class="section-title">Durum</h2>
        <div class="actions">
          @if (b.status === 'pending') {
            <button type="button" class="btn btn--brand" (click)="setStatus(b.id, 'active')">
              Onayla ve Yayınla
            </button>
            <button type="button" class="btn btn--secondary" (click)="setStatus(b.id, 'rejected')">
              Reddet
            </button>
          }
          @if (b.status === 'active') {
            <button type="button" class="btn btn--secondary" (click)="setStatus(b.id, 'suspended')">
              Askıya Al
            </button>
          }
          @if (b.status === 'suspended') {
            <button type="button" class="btn btn--brand" (click)="setStatus(b.id, 'active')">
              Tekrar Yayınla
            </button>
            <button type="button" class="btn btn--secondary" (click)="setStatus(b.id, 'archived')">
              Kaldır
            </button>
          }
          @if (b.status === 'rejected' || b.status === 'archived') {
            <button type="button" class="btn btn--brand" (click)="setStatus(b.id, 'pending')">
              Tekrar Değerlendir
            </button>
          }
        </div>
      </div>

      <form class="card" novalidate (submit)="onSave($event, b.id)">
        <h2 class="section-title">Bilgileri Düzenle</h2>

        @if (saveError(); as err) {
          <p class="form-banner form-banner--error" role="alert">{{ err }}</p>
        }
        @if (saved()) {
          <p class="form-banner form-banner--success" role="status">Kaydedildi.</p>
        }

        <div class="field">
          <label class="field__label" for="edit-name">İşletme adı</label>
          <input id="edit-name" class="field__input" type="text" [formField]="editForm.businessName" />
          @if (editForm.businessName().touched() && editForm.businessName().errors()[0]; as err) {
            <p class="field__error">{{ err.message }}</p>
          }
        </div>

        <div class="field">
          <label class="field__label" for="edit-phone">Telefon</label>
          <input id="edit-phone" class="field__input" type="tel" [formField]="editForm.phone" />
          @if (editForm.phone().touched() && editForm.phone().errors()[0]; as err) {
            <p class="field__error">{{ err.message }}</p>
          }
        </div>

        <div class="field">
          <label class="field__label" for="edit-whatsapp">WhatsApp</label>
          <input id="edit-whatsapp" class="field__input" type="tel" [formField]="editForm.whatsapp" />
          @if (editForm.whatsapp().touched() && editForm.whatsapp().errors()[0]; as err) {
            <p class="field__error">{{ err.message }}</p>
          }
        </div>

        <div class="field">
          <label class="field__label" for="edit-address">Adres</label>
          <input id="edit-address" class="field__input" type="text" [formField]="editForm.address" />
        </div>

        <div class="field">
          <label class="field__label" for="edit-district">İlçe</label>
          <input id="edit-district" class="field__input" type="text" [formField]="editForm.district" />
        </div>

        <div class="field">
          <label class="field__label" for="edit-neighborhood">Mahalle</label>
          <input
            id="edit-neighborhood"
            class="field__input"
            type="text"
            [formField]="editForm.neighborhood"
          />
        </div>

        <div class="field-row">
          <div class="field">
            <label class="field__label" for="edit-lat">Enlem (latitude)</label>
            <input
              id="edit-lat"
              class="field__input"
              type="number"
              step="any"
              [value]="latitude()"
              (input)="latitude.set($any($event.target).value)"
            />
          </div>
          <div class="field">
            <label class="field__label" for="edit-lon">Boylam (longitude)</label>
            <input
              id="edit-lon"
              class="field__input"
              type="number"
              step="any"
              [value]="longitude()"
              (input)="longitude.set($any($event.target).value)"
            />
          </div>
        </div>
        <p class="muted field__hint">
          "Yakınımdaki Taksiler" bu ikisi doluysa çalışır. Google Maps'te işletmeye sağ tıklayıp
          koordinatları kopyalayabilirsiniz.
        </p>

        <div class="field">
          <label class="field__label" for="edit-website">Web sitesi</label>
          <input id="edit-website" class="field__input" type="text" [formField]="editForm.website" />
        </div>

        <div class="field">
          <label class="field__label" for="edit-description">Açıklama</label>
          <textarea id="edit-description" class="field__input" rows="4" [formField]="editForm.description"></textarea>
        </div>

        <div class="field">
          <label class="field__label" for="edit-verified">Doğrulama</label>
          <select id="edit-verified" class="field__input" [formField]="editForm.verified">
            <option value="false">Doğrulanmadı</option>
            <option value="true">Doğrulandı (telefon kontrol edildi)</option>
          </select>
        </div>

        <div class="field">
          <label class="field__label" for="edit-plan">Plan</label>
          <select id="edit-plan" class="field__input" [formField]="editForm.plan">
            <option value="free">Ücretsiz</option>
            <option value="pro">Pro</option>
            <option value="premium">Premium</option>
          </select>
          <p class="muted field__hint">
            Pro/Premium: "Öne Çıkan" rozeti + sınırsız fotoğraf (§58 — sıralamayı ETKİLEMEZ).
          </p>
        </div>

        <button type="submit" class="btn btn--brand" [disabled]="saving()">
          {{ saving() ? 'Kaydediliyor…' : 'Kaydet' }}
        </button>
      </form>

      <div class="card">
        <h2 class="section-title">Bölgeler</h2>
        <p class="muted field__hint">
          Ana sayfadaki "Popüler Taksi Bölgeleri" ve bölge sayfaları işletmeleri BURADAN bulur —
          hiçbiri işaretlenmezse işletme hiçbir bölge sayfasında görünmez.
        </p>

        @if (tagsError(); as err) {
          <p class="form-banner form-banner--error" role="alert">{{ err }}</p>
        }
        @if (tagsSaved()) {
          <p class="form-banner form-banner--success" role="status">Kaydedildi.</p>
        }

        @if (locations.isLoading()) {
          <app-skeleton height="6rem" />
        } @else {
          <ul class="checkbox-list">
            @for (loc of locations.value() ?? []; track loc.id) {
              <li>
                <label>
                  <input
                    type="checkbox"
                    [checked]="selectedLocationIds().has(loc.id)"
                    (change)="toggleLocation(loc.id)"
                  />
                  {{ loc.name }}
                </label>
              </li>
            }
          </ul>
        }

        <button type="button" class="btn btn--brand" [disabled]="savingTags()" (click)="saveLocations(b.id)">
          {{ savingTags() ? 'Kaydediliyor…' : 'Bölgeleri Kaydet' }}
        </button>
      </div>

      <div class="card">
        <h2 class="section-title">Hizmetler</h2>
        <p class="muted field__hint">
          Ana sayfadaki "Hizmetler" bölümü ve hizmet sayfaları işletmeleri BURADAN bulur.
        </p>

        @if (services.isLoading()) {
          <app-skeleton height="6rem" />
        } @else {
          <ul class="checkbox-list">
            @for (s of services.value() ?? []; track s.id) {
              <li>
                <label>
                  <input
                    type="checkbox"
                    [checked]="selectedServiceIds().has(s.id)"
                    (change)="toggleService(s.id)"
                  />
                  {{ s.name }}
                </label>
              </li>
            }
          </ul>
        }

        <button type="button" class="btn btn--brand" [disabled]="savingTags()" (click)="saveServices(b.id)">
          {{ savingTags() ? 'Kaydediliyor…' : 'Hizmetleri Kaydet' }}
        </button>
      </div>
    } @else {
      <p class="lead">İşletme bulunamadı.</p>
    }
  `,
  styles: `
    .back-link {
      display: inline-block;
      margin-block-end: var(--sp-4);
      color: var(--c-text-muted);
      text-decoration: none;
    }

    .page-title {
      margin-block-end: var(--sp-2);
    }

    .duplicate-banner,
    .status-actions {
      margin-block-start: var(--sp-5);
    }

    .section-title {
      margin-block-end: var(--sp-3);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-3);
      margin-block-start: var(--sp-3);
    }

    form.card {
      margin-block-start: var(--sp-5);
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

    .field__hint {
      margin-block-start: var(--sp-1);
      font-size: var(--fs-xs);
    }

    .field-row {
      display: flex;
      gap: var(--sp-3);
    }

    .field-row .field {
      flex: 1;
    }

    .checkbox-list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-2) var(--sp-4);
      list-style: none;
      padding: 0;
      margin-block: var(--sp-3);
    }

    .checkbox-list label {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
    }
  `,
})
export class AdminBusinessDetailPage {
  private readonly repo = inject(AdminBusinessRepository);
  private readonly locationRepo = inject(AdminLocationRepository);
  private readonly serviceRepo = inject(AdminServiceRepository);
  private readonly seo = inject(SeoService);

  readonly id = input.required<string>();

  protected readonly actionError = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);

  protected readonly latitude = signal('');
  protected readonly longitude = signal('');

  protected readonly business = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.repo.byId(params),
  });

  protected readonly locations = rxResource({ stream: () => this.locationRepo.all() });
  protected readonly services = rxResource({ stream: () => this.serviceRepo.all() });

  private readonly businessLocationIds = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.repo.locationIdsFor(params),
  });
  private readonly businessServiceIds = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.repo.serviceIdsFor(params),
  });

  protected readonly selectedLocationIds = signal<Set<string>>(new Set());
  protected readonly selectedServiceIds = signal<Set<string>>(new Set());
  protected readonly tagsError = signal<string | null>(null);
  protected readonly tagsSaved = signal(false);
  protected readonly savingTags = signal(false);

  private readonly editModel = signal({
    businessName: '',
    phone: '',
    whatsapp: '',
    address: '',
    district: '',
    neighborhood: '',
    website: '',
    description: '',
    verified: 'false',
    plan: 'free' as BusinessPlan,
  });

  protected readonly editForm = form(this.editModel, (path) => {
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

  private hasLoadedForm = false;
  private hasLoadedTags = false;

  constructor() {
    this.seo.setPage({
      title: 'İşletme Düzenle — Yönetim Paneli',
      description: 'Admin paneli.',
      path: '/admin/isletmeler',
      noindex: true,
    });

    // İşletme yüklendiğinde formu BİR KEZ doldur — sonraki her `business`
    // yeniden çözülmesinde (ör. durum değişikliğinden sonra reload) kullanıcının
    // düzenlemekte olduğu form verisini ÜZERİNE YAZMAMAK için tek seferlik.
    effect(() => {
      const b = this.business.value();
      if (b && !this.hasLoadedForm) {
        this.hasLoadedForm = true;
        this.editModel.set({
          businessName: b.business_name,
          phone: b.phone_e164 ?? '',
          whatsapp: b.whatsapp_e164 ?? '',
          address: b.address ?? '',
          district: b.district ?? '',
          neighborhood: b.neighborhood ?? '',
          website: b.website ?? '',
          description: b.description ?? '',
          verified: b.verification_status === 'verified' ? 'true' : 'false',
          plan: b.plan,
        });
        this.latitude.set(b.latitude?.toString() ?? '');
        this.longitude.set(b.longitude?.toString() ?? '');
      }
    });

    // Aynı desen: bölge/hizmet etiketleri de BİR KEZ yüklenir, sonra kullanıcının
    // henüz kaydetmediği checkbox seçimlerinin üzerine yazılmaz.
    effect(() => {
      const locIds = this.businessLocationIds.value();
      const svcIds = this.businessServiceIds.value();
      if (locIds && svcIds && !this.hasLoadedTags) {
        this.hasLoadedTags = true;
        this.selectedLocationIds.set(new Set(locIds));
        this.selectedServiceIds.set(new Set(svcIds));
      }
    });
  }

  protected statusLabel(status: BusinessStatus): string {
    return STATUS_LABELS[status];
  }

  protected setStatus(id: string, status: BusinessStatus): void {
    this.actionError.set(null);
    this.repo.updateStatus(id, status).subscribe({
      next: () => this.business.reload(),
      error: () => this.actionError.set('Durum güncellenemedi. Lütfen tekrar deneyin.'),
    });
  }

  protected dismissDuplicate(id: string): void {
    this.actionError.set(null);
    this.repo.dismissDuplicate(id).subscribe({
      next: () => this.business.reload(),
      error: () => this.actionError.set('İşaret kaldırılamadı. Lütfen tekrar deneyin.'),
    });
  }

  protected reject(id: string): void {
    this.setStatus(id, 'rejected');
  }

  protected onSave(event: Event, id: string): void {
    event.preventDefault();
    this.editForm().markAsTouched();
    if (this.editForm().errorSummary().length > 0) {
      return;
    }

    const model = this.editModel();
    const phone = model.phone.trim();
    const whatsapp = model.whatsapp.trim();
    const lat = this.latitude().trim();
    const lon = this.longitude().trim();

    this.saveError.set(null);
    this.saved.set(false);

    if (Boolean(lat) !== Boolean(lon)) {
      this.saveError.set('Enlem ve boylam birlikte girilmeli ya da ikisi de boş bırakılmalı.');
      return;
    }

    this.saving.set(true);

    const patch: Partial<AdminBusinessRow> = {
      business_name: model.businessName.trim(),
      phone_e164: phone ? normalizeTrPhone(phone) : null,
      whatsapp_e164: whatsapp ? normalizeTrPhone(whatsapp) : null,
      address: model.address.trim() || null,
      district: model.district.trim() || null,
      neighborhood: model.neighborhood.trim() || null,
      latitude: lat ? Number(lat) : null,
      longitude: lon ? Number(lon) : null,
      website: model.website.trim() || null,
      description: model.description.trim() || null,
      verification_status: model.verified === 'true' ? 'verified' : 'unverified',
      plan: model.plan,
    };

    this.repo.updateFields(id, patch).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
        this.business.reload();
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set('Kaydedilemedi. Lütfen tekrar deneyin.');
      },
    });
  }

  protected toggleLocation(id: string): void {
    this.selectedLocationIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected toggleService(id: string): void {
    this.selectedServiceIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected saveLocations(businessId: string): void {
    this.tagsError.set(null);
    this.tagsSaved.set(false);
    this.savingTags.set(true);
    this.repo.setLocations(businessId, [...this.selectedLocationIds()]).subscribe({
      next: () => {
        this.savingTags.set(false);
        this.tagsSaved.set(true);
      },
      error: () => {
        this.savingTags.set(false);
        this.tagsError.set('Bölgeler kaydedilemedi. Lütfen tekrar deneyin.');
      },
    });
  }

  protected saveServices(businessId: string): void {
    this.tagsError.set(null);
    this.tagsSaved.set(false);
    this.savingTags.set(true);
    this.repo.setServices(businessId, [...this.selectedServiceIds()]).subscribe({
      next: () => {
        this.savingTags.set(false);
        this.tagsSaved.set(true);
      },
      error: () => {
        this.savingTags.set(false);
        this.tagsError.set('Hizmetler kaydedilemedi. Lütfen tekrar deneyin.');
      },
    });
  }
}
