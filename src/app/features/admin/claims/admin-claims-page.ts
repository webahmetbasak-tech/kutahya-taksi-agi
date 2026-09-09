import { Component, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AdminClaimRepository } from '@core/data/admin-claim.repository';
import type { ClaimStatus } from '@core/data/models';
import { SeoService } from '@core/seo/seo.service';
import { formatTrDate } from '@shared/utils/date';
import { Skeleton } from '@shared/ui/skeleton';

const TABS: { value: ClaimStatus | undefined; label: string }[] = [
  { value: 'pending', label: 'Bekleyenler' },
  { value: undefined, label: 'Tümü' },
  { value: 'approved', label: 'Onaylananlar' },
  { value: 'rejected', label: 'Reddedilenler' },
  { value: 'cancelled', label: 'İptal edilenler' },
];

/**
 * `/admin/talepler` — sahiplenme talebi inceleme (Faz 9a).
 *
 * Onay/red `approve_claim`/`reject_claim` RPC'lerinden geçer (bkz.
 * `AdminClaimRepository` yorumu — çok kolonlu CHECK kısıtı nedeniyle).
 */
@Component({
  selector: 'app-admin-claims-page',
  imports: [RouterLink, RouterLinkActive, Skeleton],
  template: `
    <h1 class="page-title">Sahiplenme Talepleri</h1>

    <nav class="tabs" aria-label="Duruma göre filtrele">
      @for (tab of tabs; track tab.label) {
        <a
          [routerLink]="['/admin/talepler']"
          [queryParams]="{ durum: tab.value }"
          routerLinkActive="is-active"
          [routerLinkActiveOptions]="{ exact: true }"
          class="tabs__link"
        >
          {{ tab.label }}
        </a>
      }
    </nav>

    @if (actionError(); as err) {
      <p class="form-banner form-banner--error" role="alert">{{ err }}</p>
    }

    @if (claims.isLoading()) {
      <app-skeleton height="6rem" />
      <app-skeleton height="6rem" />
    } @else if ((claims.value() ?? []).length === 0) {
      <p class="muted">Bu durumda talep yok.</p>
    } @else {
      <ul class="claim-list">
        @for (c of claims.value() ?? []; track c.id) {
          <li class="card claim-item">
            <div class="claim-item__header">
              <a [routerLink]="['/admin/isletmeler', c.business_id]">İşletmeyi Gör</a>
              <span class="muted">{{ formatTrDate(c.submitted_at) }}</span>
            </div>
            @if (c.contact_phone_e164) {
              <p>İletişim telefonu: {{ c.contact_phone_e164 }}</p>
            }
            @if (c.note) {
              <p class="muted">Not: {{ c.note }}</p>
            }
            @if (c.reviewer_note) {
              <p class="muted">İnceleme notu: {{ c.reviewer_note }}</p>
            }

            @if (c.status === 'pending') {
              <div class="review">
                <label class="visually-hidden" [attr.for]="'note-' + c.id">İnceleme notu</label>
                <input
                  [id]="'note-' + c.id"
                  class="field__input"
                  type="text"
                  placeholder="İsteğe bağlı not…"
                  [value]="noteDraft(c.id)"
                  (input)="setNoteDraft(c.id, $any($event.target).value)"
                />
                <div class="actions">
                  <button type="button" class="btn btn--brand" (click)="approve(c.id)">Onayla</button>
                  <button type="button" class="btn btn--secondary" (click)="reject(c.id)">Reddet</button>
                </div>
              </div>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-2);
      margin-block-end: var(--sp-5);
    }

    .tabs__link {
      display: inline-flex;
      align-items: center;
      min-height: var(--tap-min);
      padding-inline: var(--sp-3);
      border-radius: var(--radius-full);
      border: 1px solid var(--c-border);
      text-decoration: none;
      font-size: var(--fs-sm);
      color: var(--c-text-muted);
    }

    .tabs__link.is-active {
      color: var(--c-action-strong);
      background-color: var(--c-action-soft);
      border-color: transparent;
    }

    .claim-list {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }

    .claim-item__header {
      display: flex;
      justify-content: space-between;
      gap: var(--sp-3);
      font-size: var(--fs-sm);
    }

    .claim-item p + p {
      margin-block-start: var(--sp-1);
    }

    .review {
      margin-block-start: var(--sp-3);
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }

    .actions {
      display: flex;
      gap: var(--sp-3);
    }
  `,
})
export class AdminClaimsPage {
  private readonly repo = inject(AdminClaimRepository);
  private readonly seo = inject(SeoService);

  readonly durum = input<ClaimStatus | undefined>('pending');
  protected readonly tabs = TABS;
  protected readonly actionError = signal<string | null>(null);

  private readonly noteDrafts = signal<Record<string, string>>({});

  protected readonly claims = rxResource({
    params: () => this.durum(),
    stream: ({ params }) => this.repo.all(params),
  });

  protected readonly formatTrDate = formatTrDate;

  protected noteDraft(claimId: string): string {
    return this.noteDrafts()[claimId] ?? '';
  }

  protected setNoteDraft(claimId: string, value: string): void {
    this.noteDrafts.update((drafts) => ({ ...drafts, [claimId]: value }));
  }

  protected approve(claimId: string): void {
    this.actionError.set(null);
    this.repo.approve(claimId, this.noteDraft(claimId).trim() || undefined).subscribe({
      next: () => this.claims.reload(),
      error: () =>
        this.actionError.set('Talep onaylanamadı — belki zaten işlenmiş. Sayfayı yenileyin.'),
    });
  }

  protected reject(claimId: string): void {
    this.actionError.set(null);
    this.repo.reject(claimId, this.noteDraft(claimId).trim() || undefined).subscribe({
      next: () => this.claims.reload(),
      error: () =>
        this.actionError.set('Talep reddedilemedi — belki zaten işlenmiş. Sayfayı yenileyin.'),
    });
  }

  constructor() {
    this.seo.setPage({
      title: 'Sahiplenme Talepleri — Yönetim Paneli',
      description: 'Admin paneli.',
      path: '/admin/talepler',
      noindex: true,
    });
  }
}
