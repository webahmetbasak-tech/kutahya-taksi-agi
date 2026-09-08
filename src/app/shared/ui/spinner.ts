import { Component, input } from '@angular/core';

/**
 * Yükleniyor göstergesi.
 *
 * Ekran okuyucular için `role="status"` ile duyurulur; görsel olarak sade tutulur.
 * `prefers-reduced-motion` altında dönme durur (token'lardaki süre 0'a düşer değil,
 * animasyon tamamen kapatılır — dönen bir öğe için doğru davranış budur).
 */
@Component({
  selector: 'app-spinner',
  template: `
    <span class="spinner" role="status" [attr.aria-label]="label()">
      <span class="spinner__circle" aria-hidden="true"></span>
    </span>
  `,
  styles: `
    .spinner {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .spinner__circle {
      width: 1.25rem;
      height: 1.25rem;
      border: 2px solid var(--c-border-strong);
      border-top-color: var(--c-action);
      border-radius: var(--radius-full);
      animation: spinner-rotate 700ms linear infinite;
    }

    @keyframes spinner-rotate {
      to {
        transform: rotate(360deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .spinner__circle {
        animation: none;
      }
    }
  `,
})
export class Spinner {
  readonly label = input('Yükleniyor');
}
