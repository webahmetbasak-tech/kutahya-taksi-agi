import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { PostgrestClient } from './postgrest.client';
import {
  BUSINESS_CARD_FIELDS,
  BUSINESS_DETAIL_FIELDS,
  type BusinessCard,
  type BusinessDetail,
} from './models';

/**
 * İşletme okuma sorguları.
 *
 * NOT: `status = 'active'` filtresi burada AYRICA yazılmaz. RLS zaten yalnızca
 * aktif işletmeleri döndürür (§54); filtreyi iki yerde tutmak, ileride biri
 * değişirse sessiz tutarsızlık üretirdi. Güvenlik sınırı tek yerde: veritabanında.
 */
@Injectable({ providedIn: 'root' })
export class BusinessRepository {
  private readonly client = inject(PostgrestClient);

  /** Yayındaki işletmeler. */
  list(limit = 50): Observable<BusinessCard[]> {
    return this.client.list<BusinessCard>('businesses', {
      select: BUSINESS_CARD_FIELDS,
      order: 'business_name.asc',
      limit,
    });
  }

  /** Slug ile tek işletme; bulunamazsa `null`. */
  bySlug(slug: string): Observable<BusinessDetail | null> {
    return this.client.single<BusinessDetail>('businesses', {
      select: BUSINESS_DETAIL_FIELDS,
      slug: `eq.${slug}`,
    });
  }

  /**
   * Eski slug ile taşınmış işletmeyi bulur (§64).
   * Faz 4'te 301 yönlendirmesi bunu kullanacak.
   */
  currentSlugForOldSlug(oldSlug: string): Observable<{ businesses: { slug: string } } | null> {
    return this.client.single<{ businesses: { slug: string } }>('business_slug_history', {
      select: 'businesses(slug)',
      old_slug: `eq.${oldSlug}`,
    });
  }
}
