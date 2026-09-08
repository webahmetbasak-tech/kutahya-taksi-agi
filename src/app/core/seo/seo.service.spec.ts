import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { SeoService } from './seo.service';
import { APP_CONFIG } from '@core/config/app-config';
import type { AppEnvironment } from '@env';

function configure(production: boolean) {
  TestBed.resetTestingModule();
  document.head
    .querySelectorAll('link[rel="canonical"], meta[name], meta[property]')
    .forEach((el) => el.remove());

  const config: AppEnvironment = {
    environment: production ? 'production' : 'development',
    production,
    siteUrl: 'https://example.test',
    supabaseUrl: '',
    supabaseAnonKey: '',
  };

  TestBed.configureTestingModule({ providers: [{ provide: APP_CONFIG, useValue: config }] });
  return TestBed.inject(SeoService);
}

describe('SeoService', () => {
  it('title, description, canonical ve OpenGraph etiketlerini yazar', () => {
    const seo = configure(true);

    seo.setPage({
      title: 'Zümrüt Taksi — Kütahya',
      description: 'Kütahya merkezde 7/24 taksi hizmeti.',
      path: '/taksi/zumrut-taksi',
    });

    const title = TestBed.inject(Title);
    const meta = TestBed.inject(Meta);

    expect(title.getTitle()).toBe('Zümrüt Taksi — Kütahya');
    expect(meta.getTag('name="description"')?.content).toBe('Kütahya merkezde 7/24 taksi hizmeti.');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://example.test/taksi/zumrut-taksi',
    );
    expect(meta.getTag('property="og:url"')?.content).toBe(
      'https://example.test/taksi/zumrut-taksi',
    );
    expect(meta.getTag('property="og:title"')?.content).toBe('Zümrüt Taksi — Kütahya');
  });

  it('canonical linki tekrar çağrıda YENİ eklemez, günceller', () => {
    const seo = configure(true);

    seo.setPage({ title: 'A', description: 'a', path: '/a' });
    seo.setPage({ title: 'B', description: 'b', path: '/b' });

    const links = document.querySelectorAll('link[rel="canonical"]');
    expect(links.length).toBe(1);
    expect(links[0]?.getAttribute('href')).toBe('https://example.test/b');
  });

  it('productionda normal sayfa index,follow alır', () => {
    const seo = configure(true);
    seo.setPage({ title: 'A', description: 'a', path: '/a' });

    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('index, follow');
  });

  it('productionda noindex:true verilen sayfa noindex,follow alır (eşiği geçmemiş landing page)', () => {
    const seo = configure(true);
    seo.setPage({ title: 'A', description: 'a', path: '/a', noindex: true });

    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex, follow');
  });

  it('production DIŞINDA sayfa noindex:false olsa bile HER ZAMAN noindex,nofollow alır', () => {
    const seo = configure(false);
    seo.setPage({ title: 'A', description: 'a', path: '/a', noindex: false });

    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex, nofollow');
  });
});
