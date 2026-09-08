import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { ClaimPage } from './claim-page';
import { AuthService } from '@core/auth/auth.service';
import { AnalyticsService } from '@core/analytics/analytics.service';
import { provideAppConfig } from '@core/config/app-config';

@Component({ template: '' })
class StubAuthPage {}

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

function mockAuth(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ready: signal(true),
    isAuthenticated: signal(true),
    user: signal<{ id: string; email: string | null } | null>({ id: 'user-1', email: 'sahip@example.test' }),
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  };
}

describe('ClaimPage', () => {
  let http: HttpTestingController;
  let trackSpy: ReturnType<typeof vi.fn>;
  let currentFixture: ReturnType<typeof TestBed.createComponent<ClaimPage>>;

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
      imports: [ClaimPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'giris', component: StubAuthPage }]),
        provideAppConfig(),
        { provide: AuthService, useValue: auth },
        { provide: AnalyticsService, useValue: { track: trackSpy } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ClaimPage);
    fixture.componentRef.setInput('slug', 'zumrut-taksi');
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
    // `business` kaynağı oturumdan bağımsız her zaman istek atar — bekleyen
    // isteği yanıtlamadan `whenStable()` süresiz beklerdi.
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([]);
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith(['/giris'], {
      queryParams: { redirect: '/taksi/zumrut-taksi/sahiplen' },
    });
  });

  it('işletme yoksa 404 benzeri mesaj gösterir', async () => {
    const fixture = await setup(mockAuth());
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([]);
    await tick();
    http.expectOne((r) => r.url.includes('/rest/v1/claims')).flush([]);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('İşletme bulunamadı');
  });

  it('daha önce talep yoksa sahiplenme formunu gösterir ve claim_started izler', async () => {
    const fixture = await setup(mockAuth());
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([BUSINESS_ROW]);
    await tick();
    http.expectOne((r) => r.url.includes('/rest/v1/claims')).flush([]);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain("Zümrüt Taksi'ı Sahiplen");
    expect(el.querySelector('#claim-phone')).not.toBeNull();
    expect(trackSpy).toHaveBeenCalledWith({ eventType: 'claim_started', businessId: 'biz-1' });
  });

  it('bekleyen bir talep varsa formu göstermez, durum mesajı gösterir', async () => {
    const fixture = await setup(mockAuth());
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([BUSINESS_ROW]);
    await tick();
    http.expectOne((r) => r.url.includes('/rest/v1/claims')).flush([
      {
        id: 'claim-1',
        business_id: 'biz-1',
        status: 'pending',
        verification_method: 'manual_admin',
        submitted_at: '2026-09-01T00:00:00Z',
        reviewer_note: null,
      },
    ]);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('inceleniyor');
    expect(el.querySelector('#claim-phone')).toBeNull();
    expect(trackSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'claim_started' }),
    );
  });

  it('reddedilen bir talepten sonra form TEKRAR gösterilir (yeniden deneme)', async () => {
    const fixture = await setup(mockAuth());
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([BUSINESS_ROW]);
    await tick();
    http.expectOne((r) => r.url.includes('/rest/v1/claims')).flush([
      {
        id: 'claim-1',
        business_id: 'biz-1',
        status: 'rejected',
        verification_method: 'manual_admin',
        submitted_at: '2026-09-01T00:00:00Z',
        reviewer_note: 'Telefon doğrulanamadı.',
      },
    ]);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('#claim-phone')).not.toBeNull();
  });

  it('geçerli telefonla gönderim başarılıysa claims insert edilir ve claim_completed izlenir', async () => {
    const fixture = await setup(mockAuth());
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([BUSINESS_ROW]);
    await tick();
    http.expectOne((r) => r.url.includes('/rest/v1/claims') && r.method === 'GET').flush([]);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const phoneInput = el.querySelector('#claim-phone') as HTMLInputElement;
    phoneInput.value = '0555 111 22 33';
    phoneInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));

    const insertReq = http.expectOne((r) => r.url.includes('/rest/v1/claims') && r.method === 'POST');
    expect(insertReq.request.body).toEqual({
      business_id: 'biz-1',
      user_id: 'user-1',
      contact_phone_e164: '+905551112233',
      note: null,
    });
    insertReq.flush(null);
    await tick();

    http.expectOne((r) => r.url.includes('/rest/v1/claims') && r.method === 'GET').flush([]);
    await fixture.whenStable();

    expect(trackSpy).toHaveBeenCalledWith({ eventType: 'claim_completed', businessId: 'biz-1' });
  });

  it('geçersiz telefonla göndermeye çalışırsa istek atılmadan hata gösterir', async () => {
    const fixture = await setup(mockAuth());
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([BUSINESS_ROW]);
    await tick();
    http.expectOne((r) => r.url.includes('/rest/v1/claims')).flush([]);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    el.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(el.textContent).toContain('Telefon numarası gerekli');
    http.expectNone((r) => r.url.includes('/rest/v1/claims') && r.method === 'POST');
  });
});
