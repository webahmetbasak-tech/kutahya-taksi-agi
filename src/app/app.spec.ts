import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { App } from './app';
import { APP_CONFIG } from '@core/config/app-config';
import type { AppEnvironment } from '@env';
import { routes } from './app.routes';

function configFor(production: boolean): AppEnvironment {
  return {
    environment: production ? 'production' : 'development',
    production,
    siteUrl: 'https://example.test',
    supabaseUrl: '',
    supabaseAnonKey: '',
  };
}

async function setup(production: boolean) {
  TestBed.resetTestingModule();

  // `Meta` paylaşılan `document`'a yazar ve TestBed sıfırlaması head'i temizlemez.
  // Temizlemezsek önceki testin bıraktığı etiket bir sonrakini yanıltır.
  document.head.querySelectorAll('meta[name="robots"]').forEach((tag) => tag.remove());

  await TestBed.configureTestingModule({
    imports: [App],
    providers: [provideRouter(routes), { provide: APP_CONFIG, useValue: configFor(production) }],
  }).compileComponents();

  const fixture = TestBed.createComponent(App);
  await fixture.whenStable();
  return fixture;
}

describe('App kabuğu', () => {
  it('oluşturulabilir', async () => {
    const fixture = await setup(false);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('başlık, ana içerik ve alt bilgi barındırır', async () => {
    const fixture = await setup(false);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('app-site-header')).toBeTruthy();
    expect(el.querySelector('main#main')).toBeTruthy();
    expect(el.querySelector('app-site-footer')).toBeTruthy();
  });

  it('klavye kullanıcıları için "içeriğe atla" bağlantısı sunar', async () => {
    const fixture = await setup(false);
    const skip = (fixture.nativeElement as HTMLElement).querySelector('a.skip-link');

    expect(skip?.getAttribute('href')).toBe('#main');
  });

  it('production dışı ortamda noindex ekler', async () => {
    await setup(false);
    const robots = TestBed.inject(Meta).getTag('name="robots"');

    expect(robots?.content).toBe('noindex, nofollow');
  });

  it('production ortamında noindex EKLEMEZ', async () => {
    await setup(true);
    const robots = TestBed.inject(Meta).getTag('name="robots"');

    expect(robots).toBeNull();
  });
});
