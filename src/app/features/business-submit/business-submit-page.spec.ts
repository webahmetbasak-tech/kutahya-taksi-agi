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

  async function setup(auth: ReturnType<typeof mockAuth>) {
    const fixture = await configure(auth);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('oturum yoksa /girise redirect parametresiyle yönlendirir', async () => {
    const auth = mockAuth({ isAuthenticated: signal(false), user: signal(null) });
    const fixture = await configure(auth);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith(['/giris'], { queryParams: { redirect: '/isletme-ekle' } });
  });

  it('oturum açıksa formu gösterir', async () => {
    const fixture = await setup(mockAuth());
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('#biz-name')).not.toBeNull();
    expect(el.querySelector('#biz-phone')).not.toBeNull();
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
