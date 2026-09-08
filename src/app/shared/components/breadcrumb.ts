import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface BreadcrumbItem {
  label: string;
  /** Son öğe (mevcut sayfa) genellikle link taşımaz. */
  path?: string;
}

/**
 * Görsel ekmek kırıntısı navigasyonu (§42 internal linking).
 *
 * Yapılandırılmış veri karşılığı AYRI olarak `SchemaService` +
 * `buildBreadcrumbList()` ile eklenir — Google, JSON-LD ve microdata'nın
 * karıştırılmamasını önerir, bu yüzden bu bileşen SADECE görünür HTML üretir.
 */
@Component({
  selector: 'app-breadcrumb',
  imports: [RouterLink],
  template: `
    <nav class="breadcrumb" aria-label="Ekmek kırıntısı">
      <ol>
        @for (item of items(); track item.label; let last = $last) {
          <li>
            @if (item.path && !last) {
              <a [routerLink]="item.path">{{ item.label }}</a>
              <span aria-hidden="true"> / </span>
            } @else {
              <span aria-current="page">{{ item.label }}</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styles: `
    .breadcrumb {
      font-size: var(--fs-sm);
      color: var(--c-text-muted);
      margin-block-end: var(--sp-3);
    }

    ol {
      display: flex;
      flex-wrap: wrap;
      list-style: none;
      padding: 0;
      margin: 0;
    }

    li {
      display: inline-flex;
      align-items: center;
    }

    a {
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    [aria-current='page'] {
      color: var(--c-text);
    }
  `,
})
export class Breadcrumb {
  readonly items = input.required<readonly BreadcrumbItem[]>();
}
