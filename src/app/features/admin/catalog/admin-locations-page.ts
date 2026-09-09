import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AdminLocationRepository } from '@core/data/admin-location.repository';
import type { LocationRow, LocationType } from '@core/data/models';
import { SeoService } from '@core/seo/seo.service';
import { Skeleton } from '@shared/ui/skeleton';

const LOCATION_TYPES: LocationType[] = [
  'city',
  'district',
  'neighborhood',
  'landmark',
  'airport',
  'hospital',
  'university',
  'bus_station',
];

const TYPE_LABELS: Record<LocationType, string> = {
  city: 'Şehir',
  district: 'İlçe',
  neighborhood: 'Mahalle',
  landmark: 'Önemli Nokta',
  airport: 'Havalimanı',
  hospital: 'Hastane',
  university: 'Üniversite',
  bus_station: 'Otogar',
};

/**
 * `/admin/bolgeler` — lokasyon yönetimi (Faz 9b). Sert `DELETE` YOK (bkz.
 * `AdminLocationRepository` yorumu).
 */
@Component({
  selector: 'app-admin-locations-page',
  imports: [Skeleton],
  template: `
    <h1 class="page-title">Bölgeler</h1>

    @if (errorMessage(); as err) {
      <p class="form-banner form-banner--error" role="alert">{{ err }}</p>
    }

    <form class="card" novalidate (submit)="onSubmit($event)">
      <h2 class="section-title">{{ editingId() ? 'Bölgeyi Düzenle' : 'Yeni Bölge' }}</h2>

      <div class="field">
        <label class="field__label" for="loc-type">Tip</label>
        <select id="loc-type" class="field__input" [value]="type()" (change)="type.set($any($event.target).value)">
          @for (t of types; track t) {
            <option [value]="t">{{ typeLabel(t) }}</option>
          }
        </select>
      </div>

      <div class="field">
        <label class="field__label" for="loc-slug">Slug</label>
        <input id="loc-slug" class="field__input" type="text" [value]="slug()" (input)="slug.set($any($event.target).value)" />
      </div>

      <div class="field">
        <label class="field__label" for="loc-name">Ad</label>
        <input id="loc-name" class="field__input" type="text" [value]="name()" (input)="name.set($any($event.target).value)" />
      </div>

      <div class="field">
        <label class="field__label" for="loc-desc">Açıklama</label>
        <textarea id="loc-desc" class="field__input" rows="2" [value]="description()" (input)="description.set($any($event.target).value)"></textarea>
      </div>

      <div class="field">
        <label class="field__label" for="loc-lat">Enlem</label>
        <input id="loc-lat" class="field__input" type="number" step="any" [value]="latitude()" (input)="latitude.set($any($event.target).value)" />
      </div>

      <div class="field">
        <label class="field__label" for="loc-lon">Boylam</label>
        <input id="loc-lon" class="field__input" type="number" step="any" [value]="longitude()" (input)="longitude.set($any($event.target).value)" />
      </div>

      <div class="actions">
        <button type="submit" class="btn btn--brand" [disabled]="saving()">
          {{ saving() ? 'Kaydediliyor…' : editingId() ? 'Güncelle' : 'Ekle' }}
        </button>
        @if (editingId()) {
          <button type="button" class="btn btn--secondary" (click)="resetForm()">Vazgeç</button>
        }
      </div>
    </form>

    @if (locations.isLoading()) {
      <app-skeleton height="3rem" />
      <app-skeleton height="3rem" />
    } @else {
      <ul class="location-list">
        @for (l of locations.value() ?? []; track l.id) {
          <li class="card location-item">
            <div class="location-item__row">
              <span>
                <strong>{{ l.name }}</strong>
                <span class="muted"> — {{ l.slug }}</span>
              </span>
              <span class="badge badge--info">{{ typeLabel(l.type) }}</span>
            </div>
            <div class="actions">
              <button type="button" class="btn btn--secondary" (click)="edit(l)">Düzenle</button>
            </div>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    form.card {
      display: flex;
      flex-direction: column;
      max-width: 28rem;
      margin-block-end: var(--sp-6);
    }

    form.card > * + * {
      margin-block-start: var(--sp-4);
    }

    .section-title {
      font-size: var(--fs-lg);
    }

    textarea.field__input {
      resize: vertical;
      font-family: inherit;
    }

    .actions {
      display: flex;
      gap: var(--sp-3);
    }

    .location-list {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }

    .location-item__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-3);
    }

    .location-item .actions {
      margin-block-start: var(--sp-3);
    }
  `,
})
export class AdminLocationsPage {
  private readonly repo = inject(AdminLocationRepository);
  private readonly seo = inject(SeoService);

  protected readonly locations = rxResource({ stream: () => this.repo.all() });
  protected readonly types = LOCATION_TYPES;

  protected readonly editingId = signal<string | null>(null);
  protected readonly type = signal<LocationType>('neighborhood');
  protected readonly slug = signal('');
  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly latitude = signal('');
  protected readonly longitude = signal('');
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.seo.setPage({
      title: 'Bölgeler — Yönetim Paneli',
      description: 'Admin paneli.',
      path: '/admin/bolgeler',
      noindex: true,
    });
  }

  protected typeLabel(type: LocationType): string {
    return TYPE_LABELS[type];
  }

  protected edit(location: LocationRow): void {
    this.editingId.set(location.id);
    this.type.set(location.type);
    this.slug.set(location.slug);
    this.name.set(location.name);
    this.description.set(location.description ?? '');
    this.latitude.set(location.latitude?.toString() ?? '');
    this.longitude.set(location.longitude?.toString() ?? '');
  }

  protected resetForm(): void {
    this.editingId.set(null);
    this.type.set('neighborhood');
    this.slug.set('');
    this.name.set('');
    this.description.set('');
    this.latitude.set('');
    this.longitude.set('');
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    const slug = this.slug().trim();
    const name = this.name().trim();
    if (!slug || !name) {
      this.errorMessage.set('Slug ve ad zorunludur.');
      return;
    }

    const lat = this.latitude().trim();
    const lon = this.longitude().trim();
    if (Boolean(lat) !== Boolean(lon)) {
      this.errorMessage.set('Enlem ve boylam birlikte girilmeli ya da ikisi de boş bırakılmalı.');
      return;
    }

    this.errorMessage.set(null);
    this.saving.set(true);

    const payload = {
      type: this.type(),
      slug,
      name,
      description: this.description().trim() || null,
      latitude: lat ? Number(lat) : null,
      longitude: lon ? Number(lon) : null,
      source_type: 'manual' as const,
    };

    const editingId = this.editingId();
    const request = editingId ? this.repo.update(editingId, payload) : this.repo.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.resetForm();
        this.locations.reload();
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set('Kaydedilemedi — slug zaten kullanımda olabilir.');
      },
    });
  }
}
