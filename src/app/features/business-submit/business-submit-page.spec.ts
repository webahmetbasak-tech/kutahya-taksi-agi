import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { BusinessSubmitPage } from './business-submit-page';
import { AuthService } from '@core/auth/auth.service';
import { AnalyticsService } from '@core/analytics/analytics.service';
import { BusinessMediaService } from '@core/storage/business-media.service';
import { provideAppConfig } from '@core/config/app-config';

@Component({ template: '' })
class StubAuthPage {}

function mockAuth(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ready: signal(true),
    isAuthenticated: signal(true),
    user: signal<{ id: string; email: string | null } | null>({ id: 'user-1', email: 'sahip@example.test' }),
    ...overrides,
  };
}

describe('BusinessSubmitPage', () => {
  let http: HttpTestingController;
  let trackSpy: ReturnType<typeof vi.fn>;
  let currentFixture: ReturnType<typeof TestBed.createComponent<BusinessSubmitPage>>;

  const tick = async () => {
    for (let i = 0; i < 5; i++) {
      currentFixture.detectChanges();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  async function configure(auth: ReturnType<typeof mockAuth>) {
    trackSpy = vi.fn();
    await TestBed.configureTestingModule({
      imports: [BusinessSubmitPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'giris', component: StubAuthPage }]),
        provideAppConfig(),
        { provide: AuthService, useValue: auth },
        { provide: AnalyticsService, useValue: { track: trackSpy } },
        { provide: BusinessMediaService, useValue: { validate: () => null, upload: vi.fn() } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(BusinessSubmitPage);
    currentFixture = fixture;
    return fixture;
  }

  async function setup(auth: ReturnType<typeof mockAuth>, districts: { id: string; name: string }[] = []) {
    const fixture = await configure(auth);
    fixture.detectChanges();
    http.expectOne((r) => r.url.includes('/rest/v1/locations')).flush(districts);
    await tick();
    return fixture;
  }

  afterEach(() => http.verify());

  it('oturum yoksa /girise redirect parametresiyle yönlendirir', async () => {
    const auth = mockAuth({ isAuthenticated: signal(false), user: signal(null) });
    const fixture = await configure(auth);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.detectChanges();
    http.expectOne((r) => r.url.includes('/rest/v1/locations')).flush([]);
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith(['/giris'], { queryParams: { redirect: '/isletme-ekle' } });
  });

  it('oturum açıksa formu gösterir; İl her zaman Kütahya olarak sabit gösterilir', async () => {
    const fixture = await setup(mockAuth());
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('#biz-name')).not.toBeNull();
    expect(el.querySelector('#biz-phone')).not.toBeNull();
    expect(el.querySelector('#biz-driver-name')).not.toBeNull();
    expect(el.textContent).toContain('Kütahya');
    expect(el.querySelector('#biz-whatsapp')).toBeNull();
    expect(el.querySelector('#biz-neighborhood')).toBeNull();
  });

  it('işletme adı boşken göndermeye çalışırsa istek atılmadan hata gösterir', async () => {
    const fixture = await setup(mockAuth());
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(el.textContent).toContain('İşletme adı gerekli');
    http.expectNone((r) => r.url.includes('/rpc/submit_business'));
  });

  it('geçersiz telefonla göndermeye çalışırsa istek atılmadan hata gösterir', async () => {
    const fixture = await setup(mockAuth());
    const el = fixture.nativeElement as HTMLElement;

    const nameInput = el.querySelector('#biz-name') as HTMLInputElement;
    nameInput.value = 'Zümrüt Taksi';
    nameInput.dispatchEvent(new Event('input'));

    const phoneInput = el.querySelector('#biz-phone') as HTMLInputElement;
    phoneInput.value = '123';
    phoneInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(el.textContent).toContain('Geçerli bir telefon numarası girin');
    http.expectNone((r) => r.url.includes('/rpc/submit_business'));
  });

  it('geçerli bilgilerle gönderim başarılıysa RPC çağrılır, sonuç gösterilir ve listing_submitted izlenir', async () => {
    const fixture = await setup(mockAuth());
    const el = fixture.nativeElement as HTMLElement;

    const nameInput = el.querySelector('#biz-name') as HTMLInputElement;
    nameInput.value = 'Zümrüt Taksi';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    const req = http.expectOne((r) => r.url.includes('/rpc/submit_business'));
    expect(req.request.body).toEqual({ p_business_name: 'Zümrüt Taksi' });
    req.flush([{ id: 'biz-1', slug: 'zumrut-taksi', possible_duplicate: false }]);
    await tick();

    expect(el.textContent).toContain('Başvurunuz Alındı');
    expect(el.textContent).not.toContain('Benzer bir işletme');
    expect(trackSpy).toHaveBeenCalledWith({ eventType: 'listing_submitted', businessId: 'biz-1' });
  });

  it('Şoför Ad Soyad girilirse p_driver_name olarak gönderilir', async () => {
    const fixture = await setup(mockAuth());
    const el = fixture.nativeElement as HTMLElement;

    const nameInput = el.querySelector('#biz-name') as HTMLInputElement;
    nameInput.value = 'Zümrüt Taksi';
    nameInput.dispatchEvent(new Event('input'));
    const driverInput = el.querySelector('#biz-driver-name') as HTMLInputElement;
    driverInput.value = 'Ahmet Yılmaz';
    driverInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    const req = http.expectOne((r) => r.url.includes('/rpc/submit_business'));
    expect(req.request.body).toEqual({ p_business_name: 'Zümrüt Taksi', p_driver_name: 'Ahmet Yılmaz' });
    req.flush([{ id: 'biz-1', slug: 'zumrut-taksi', possible_duplicate: false }]);
    await tick();
  });

  it('İlçe artık serbest metin değil, seçilebilir listeden gelir', async () => {
    const fixture = await setup(mockAuth(), [
      { id: 'loc-1', name: 'Merkez' },
      { id: 'loc-2', name: 'Emet' },
    ]);
    const el = fixture.nativeElement as HTMLElement;

    const districtSelect = el.querySelector('#biz-district') as HTMLSelectElement;
    expect(districtSelect.tagName).toBe('SELECT');

    const nameInput = el.querySelector('#biz-name') as HTMLInputElement;
    nameInput.value = 'Zümrüt Taksi';
    nameInput.dispatchEvent(new Event('input'));
    districtSelect.value = 'Emet';
    districtSelect.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    const req = http.expectOne((r) => r.url.includes('/rpc/submit_business'));
    expect(req.request.body).toEqual({ p_business_name: 'Zümrüt Taksi', p_district: 'Emet' });
    req.flush([{ id: 'biz-1', slug: 'zumrut-taksi', possible_duplicate: false }]);
    await tick();
  });

  it('olası kopya işaretlenmişse uyarı gösterir', async () => {
    const fixture = await setup(mockAuth());
    const el = fixture.nativeElement as HTMLElement;

    const nameInput = el.querySelector('#biz-name') as HTMLInputElement;
    nameInput.value = 'Zümrüt Taksi';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    const req = http.expectOne((r) => r.url.includes('/rpc/submit_business'));
    req.flush([{ id: 'biz-1', slug: 'zumrut-taksi', possible_duplicate: true }]);
    await tick();

    expect(el.textContent).toContain('Benzer bir işletme');
  });
});
