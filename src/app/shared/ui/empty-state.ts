import { Component, input } from '@angular/core';

/**
 * Boş durum bileşeni.
 *
 * Bu ürün için boş durum bir kenar senaryosu değil, başlangıçtaki normal
 * durumdur: bir bölgede henüz kayıtlı taksi olmayabilir. Kullanıcıya "sonuç yok"
 * demek yerine ne yapabileceğini söylemek gerekir — bu yüzden aksiyon slot'u var.
 */
@Component({
  selector: 'app-empty-state',
  template: `
    <div class="empty">
      <p class="empty__title">{{ title() }}</p>
      @if (description()) {
        <p class="empty__desc">{{ description() }}</p>
      }
      <div class="empty__actions">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-10) var(--sp-4);
      text-align: center;
      background-color: var(--c-bg-subtle);
      border: 1px dashed var(--c-border-strong);
      border-radius: var(--radius-lg);
    }

    .empty__title {
      font-weight: var(--fw-semibold);
      font-size: var(--fs-lg);
    }

    .empty__desc {
      color: var(--c-text-muted);
      max-width: 44ch;
    }

    .empty__actions:empty {
      display: none;
    }
  `,
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly description = input<string>();
}
