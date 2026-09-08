import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { PostgrestClient } from './postgrest.client';
import { toLandingPageDetail, type LandingPageDetail, type LandingPageStats } from './models';

const FIELDS = [
  'id',
  'slug',
  'title',
  'h1',
  'intro',
  'meta_description',
  'location_id',
  'service_id',
  'business_count',
  'is_indexable',
].join(',');

/**
 * `landing_page_stats` okuma sorguları (§31 thin content kapısı).
 *
 * Bu view SADECE `is_published=true` VE eşiği geçmiş sayfaları anon'a
 * gösterir — filtre burada TEKRAR yazılmaz, RLS + view tanımı zaten
 * uyguluyor (aynı ilke: ARCHITECTURE.md §4, "güvenlik sınırı tek yerde").
 */
@Injectable({ providedIn: 'root' })
export class LandingPageRepository {
  private readonly client = inject(PostgrestClient);

  bySlug(slug: string): Observable<LandingPageDetail | null> {
    return this.client
      .single<LandingPageStats>('landing_page_stats', {
        select: FIELDS,
        slug: `eq.${slug}`,
      })
      .pipe(map((row) => (row ? toLandingPageDetail(row) : null)));
  }

  /** Sitemap için: yalnızca gerçekten indexlenebilir sayfalar. */
  indexable(): Observable<LandingPageDetail[]> {
    return this.client
      .list<LandingPageStats>('landing_page_stats', {
        select: FIELDS,
        is_indexable: 'eq.true',
      })
      .pipe(map((rows) => rows.map(toLandingPageDetail)));
  }
}
