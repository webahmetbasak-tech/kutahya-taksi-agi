import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RemovalRequestPage } from './removal-request-page';
import { provideAppConfig } from '@core/config/app-config';

const BUSINESS_ROW = {
  id: 'biz-1',
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
};

describe('RemovalRequestPage', () => {
  let http: HttpTestingController;
  let currentFixture: ReturnType<typeof TestBed.createComponent<RemovalRequestPage>>;

  const tick = async () => {
    for (let i = 0; i < 5; i++) {
      currentFixture.detectChanges();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [RemovalRequestPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideAppConfig()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(RemovalRequestPage);
    fixture.componentRef.setInput('slug', 'zumrut-taksi');
    currentFixture = fixture;
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('oturum olmadan formu gösterir (auth-gated DEĞİL)', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([BUSINESS_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#removal-reason')).not.toBeNull();
  });

  it('sebep boşken göndermeye çalışırsa istek atılmadan hata gösterir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([BUSINESS_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(el.textContent).toContain('Sebep gerekli');
    http.expectNone((r) => r.url.includes('/rpc/request_business_removal'));
  });

  it('geçerli sebeple gönderim başarılıysa RPC çağrılır ve teşekkür mesajı gösterilir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([BUSINESS_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const reasonInput = el.querySelector('#removal-reason') as HTMLTextAreaElement;
    reasonInput.value = 'Bu benim işletmem, numaramı kaldırın.';
    reasonInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    const req = http.expectOne((r) => r.url.includes('/rpc/request_business_removal'));
    expect(req.request.body).toEqual({
      p_business_id: 'biz-1',
      p_reason: 'Bu benim işletmem, numaramı kaldırın.',
    });
    req.flush([{ id: 'req-1' }]);
    await tick();

    expect(el.textContent).toContain('Talebiniz Alındı');
  });
});
