import { RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TaxiDetailPage } from './taxi-detail-page';
import { APP_CONFIG } from '@core/config/app-config';
import type { AppEnvironment } from '@env';

const config: AppEnvironment = {
  environment: 'development',
  production: false,
  siteUrl: 'https://example.test',
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon-test-key',
};

/**
 * Bu testin varlık nedeni: taxi-detail-page.ts'teki 404 mekanizması
 * (`RESPONSE_INIT.status = 404`) yalnızca kod okuyarak doğrulanamaz — Angular'ın
 * resource + effect zamanlamasının gerçekten çalıştığını göstermek gerekir.
 * "İşletme bulunamadı → gerçek 404" iddiası ARCHITECTURE.md ve PROJECT_PLAN'da
 * defalarca tekrarlanan bir söz (§64); burada kanıtlanıyor.
 */
describe('TaxiDetailPage', () => {
  let http: HttpTestingController;
  let responseInit: { status?: number };

  async function setup(slug: string) {
    responseInit = {};

    await TestBed.configureTestingModule({
      imports: [TaxiDetailPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: APP_CONFIG, useValue: config },
        { provide: RESPONSE_INIT, useValue: responseInit },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(TaxiDetailPage);
    fixture.componentRef.setInput('slug', slug);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('işletme bulunamazsa RESPONSE_INIT.status = 404 olur (gerçek 404, soft-404 değil)', async () => {
    const fixture = await setup('olmayan-slug');

    const req = http.expectOne((r) => r.url.includes('/rest/v1/businesses'));
    req.flush([]); // PostgREST: eşleşme yok -> boş dizi -> single() null döner

    await fixture.whenStable();

    expect(responseInit.status).toBe(404);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'İşletme profili bulunamadı',
    );
  });

  it('işletme bulunursa RESPONSE_INIT.status DOKUNULMAZ ve içerik render edilir', async () => {
    const fixture = await setup('zumrut-taksi');

    const req = http.expectOne((r) => r.url.includes('/rest/v1/businesses'));
    req.flush([
      {
        id: '1',
        slug: 'zumrut-taksi',
        business_name: 'Zümrüt Taksi',
        phone_e164: '+905551112233',
        phone_display: null,
        whatsapp_e164: null,
        district: 'Merkez',
        neighborhood: null,
        verification_status: 'unverified',
        last_verified_at: null,
        google_maps_url: null,
        description: null,
        address: null,
        city: 'Kütahya',
        latitude: null,
        longitude: null,
        website: null,
        source_type: 'manual',
        updated_at: '2026-09-01T00:00:00Z',
      },
    ]);

    await fixture.whenStable();

    expect(responseInit.status).toBeUndefined();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Zümrüt Taksi');
    expect(text).not.toContain('İşletme profili bulunamadı');
  });
});
