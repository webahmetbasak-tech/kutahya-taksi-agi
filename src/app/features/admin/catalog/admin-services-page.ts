import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AdminServiceRepository } from '@core/data/admin-service.repository';
import type { Service } from '@core/data/models';
import { SeoService } from '@core/seo/seo.service';
import { Skeleton } from '@shared/ui/skeleton';

/**
 * `/admin/hizmetler` — hizmet katalog yönetimi (Faz 9b).
 *
 * Sert `DELETE` YOK (bkz. `AdminServiceRepository` yorumu) — yalnızca
 * ekleme/düzenleme/aktif-pasif.
 */
@Component({
  selector: 'app-admin-services-page',
  imports: [Skeleton],
  template: `
    <h1 class="page-title">Hizmetler</h1>

    @if (errorMessage(); as err) {
      <p class="form-banner form-banner--error" role="alert">{{ err }}</p>
    }

    <form class="card" novalidate (submit)="onSubmit($event)">
      <h2 class="section-title">{{ editingId() ? 'Hizmeti Düzenle' : 'Yeni Hizmet' }}</h2>

      <div class="field">
        <label class="field__label" for="svc-slug">Slug</label>
        <input id="svc-slug" class="field__input" type="text" [value]="slug()" (input)="slug.set($any($event.target).value)" />
      </div>

      <div class="field">
        <label class="field__label" for="svc-name">Ad</label>
        <input id="svc-name" class="field__input" type="text" [value]="name()" (input)="name.set($any($event.target).value)" />
      </div>

      <div class="field">
        <label class="field__label" for="svc-desc">Açıklama</label>
        <textarea id="svc-desc" class="field__input" rows="2" [value]="description()" (input)="description.set($any($event.target).value)"></textarea>
      </div>

      <div class="field">
        <label class="field__label" for="svc-sort">Sıra</label>
        <input id="svc-sort" class="field__input" type="number" [value]="sortOrder()" (input)="sortOrder.set($any($event.target).valueAsNumber)" />
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

    @if (services.isLoading()) {
      <app-skeleton height="3rem" />
      <app-skeleton height="3rem" />
    } @else {
      <ul class="service-list">
        @for (s of services.value() ?? []; track s.id) {
          <li class="card service-item">
            <div class="service-item__row">
              <span>
                <strong>{{ s.name }}</strong>
                <span class="muted"> — {{ s.slug }}</span>
              </span>
              <span class="badge" [class]="s.is_active ? 'badge--verified' : 'badge--warning'">
                {{ s.is_active ? 'Aktif' : 'Pasif' }}
              </span>
            </div>
            <div class="actions">
              <button type="button" class="btn btn--secondary" (click)="edit(s)">Düzenle</button>
              <button type="button" class="btn btn--secondary" (click)="toggleActive(s)">
                {{ s.is_active ? 'Pasife Al' : 'Aktif Et' }}
              </button>
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

    .service-list {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }

    .service-item__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-3);
    }

    .service-item .actions {
      margin-block-start: var(--sp-3);
    }
  `,
})
export class AdminServicesPage {
  private readonly repo = inject(AdminServiceRepository);
  private readonly seo = inject(SeoService);

  protected readonly services = rxResource({ stream: () => this.repo.all() });

  protected readonly editingId = signal<string | null>(null);
  protected readonly slug = signal('');
  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly sortOrder = signal(0);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.seo.setPage({
      title: 'Hizmetler — Yönetim Paneli',
      description: 'Admin paneli.',
      path: '/admin/hizmetler',
      noindex: true,
    });
  }

  protected edit(service: Service): void {
    this.editingId.set(service.id);
    this.slug.set(service.slug);
    this.name.set(service.name);
    this.description.set(service.description ?? '');
    this.sortOrder.set(service.sort_order);
  }

  protected resetForm(): void {
    this.editingId.set(null);
    this.slug.set('');
    this.name.set('');
    this.description.set('');
    this.sortOrder.set(0);
  }

  protected toggleActive(service: Service): void {
    this.errorMessage.set(null);
    this.repo.setActive(service.id, !service.is_active).subscribe({
      next: () => this.services.reload(),
      error: () => this.errorMessage.set('Güncellenemedi. Lütfen tekrar deneyin.'),
    });
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    const slug = this.slug().trim();
    const name = this.name().trim();
    if (!slug || !name) {
      this.errorMessage.set('Slug ve ad zorunludur.');
      return;
    }

    this.errorMessage.set(null);
    this.saving.set(true);

    const payload = {
      slug,
      name,
      description: this.description().trim() || null,
      sort_order: this.sortOrder(),
    };

    const editingId = this.editingId();
    const request = editingId ? this.repo.update(editingId, payload) : this.repo.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.resetForm();
        this.services.reload();
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set('Kaydedilemedi — slug zaten kullanımda olabilir.');
      },
    });
  }
}
