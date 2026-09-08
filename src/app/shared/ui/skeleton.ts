import { Component, input } from '@angular/core';

/**
 * İçerik yer tutucusu (skeleton).
 *
 * Amaç yalnızca "bir şey yükleniyor" demek değil, gelecek içeriğin yerini
 * şimdiden ayırarak layout kaymasını (CLS) önlemektir (§44). Bu yüzden yükseklik
 * zorunlu bir girdi gibi davranır ve varsayılanı gerçek metin satır yüksekliğidir.
 */
@Component({
  selector: 'app-skeleton',
  template: `<span
    class="skeleton"
    [style.width]="width()"
    [style.height]="height()"
    [style.border-radius]="radius()"
    aria-hidden="true"
  ></span>`,
  styles: `
    .skeleton {
      display: block;
      background: linear-gradient(
        90deg,
        var(--c-bg-muted) 25%,
        var(--c-bg-subtle) 50%,
        var(--c-bg-muted) 75%
      );
      background-size: 200% 100%;
      animation: skeleton-shimmer 1.4s ease-in-out infinite;
    }

    @keyframes skeleton-shimmer {
      to {
        background-position: -200% 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .skeleton {
        animation: none;
      }
    }
  `,
})
export class Skeleton {
  readonly width = input('100%');
  readonly height = input('1rem');
  readonly radius = input('var(--radius-sm)');
}
