import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { DashboardPage } from './dashboard-page';
import { AuthService } from '@core/auth/auth.service';
import { provideAppConfig } from '@core/config/app-config';

@Component({ template: '' })
class StubAuthPage {}

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

describe('DashboardPage', () => {
  let http: HttpTestingController;
  let currentFixture: ReturnType<typeof TestBed.createComponent<DashboardPage>>;

  const tick = async () => {
    for (let i = 0; i < 5; i++) {
      currentFixture.detectChanges();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  async function configure(auth: ReturnType<typeof mockAuth>) {
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'giris', component: StubAuthPage }]),
        provideAppConfig(),
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(DashboardPage);
    currentFixture = fixture;
    return fixture;
  }

  afterEach(() => http.verify());

  it('oturum yoksa /girise redirect=/panel ile yönlendirir', async () => {
    const auth = mockAuth({ isAuthenticated: signal(false), user: signal(null) });
    const fixture = await configure(auth);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith(['/giris'], { queryParams: { redirect: '/panel' } });
  });

  it('sahiplenilen işletme yoksa boş durum mesajı ve İşletmemi Yayınla bağlantısı gösterir', async () => {
    const fixture = await configure(mockAuth());
    fixture.detectChanges();

    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([]);
    http.expectOne((r) => r.url.includes('/rest/v1/claims')).flush([]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Henüz sahiplendiğiniz bir işletme yok.');
    expect(el.querySelector('a[href="/isletme-ekle"]')).not.toBeNull();
  });

  it('sahiplenilen işletme + istatistikleri ve durum rozetini gösterir', async () => {
    const fixture = await configure(mockAuth());
    fixture.detectChanges();

    http
      .expectOne((r) => r.url.includes('/rest/v1/businesses'))
      .flush([
        { id: 'biz-1', slug: 'zumrut-taksi', business_name: 'Zümrüt Taksi', status: 'active', verification_status: 'owner_claimed', plan: 'free' },
      ]);
    http.expectOne((r) => r.url.includes('/rest/v1/claims')).flush([]);
    await tick();

    http
      .expectOne((r) => r.url.includes('/rest/v1/analytics_daily'))
      .flush([
        { day: '2026-09-01', event_type: 'profile_view', event_count: 12 },
        { day: '2026-09-01', event_type: 'call_click', event_count: 3 },
      ]);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Zümrüt Taksi');
    expect(el.textContent).toContain('Yayında');
    const dd = Array.from(el.querySelectorAll('.stats__item dd')).map((n) => n.textContent);
    expect(dd).toContain('12');
    expect(dd).toContain('3');
  });

  it('sahiplenme talepleri listesinde durum ve inceleyen notu gösterir', async () => {
    const fixture = await configure(mockAuth());
    fixture.detectChanges();

    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([]);
    http
      .expectOne((r) => r.url.includes('/rest/v1/claims'))
      .flush([
        {
          id: 'claim-1',
          business_id: 'biz-1',
          status: 'rejected',
          verification_method: 'manual_admin',
          submitted_at: '2026-09-01T00:00:00Z',
          reviewer_note: 'Telefon doğrulanamadı.',
        },
      ]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Reddedildi');
    expect(el.textContent).toContain('Telefon doğrulanamadı.');
  });
});
