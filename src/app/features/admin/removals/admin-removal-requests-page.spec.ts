import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminRemovalRequestsPage } from './admin-removal-requests-page';
import { AuthService } from '@core/auth/auth.service';
import { provideAppConfig } from '@core/config/app-config';

const REQUEST_ROW = {
  id: 'req-1',
  business_id: 'biz-1',
  reason: 'Numaramın burada olmasını istemiyorum.',
  contact_email: 'talepci@example.test',
  status: 'pending',
  created_at: '2026-09-01T00:00:00Z',
  business: { business_name: 'Zümrüt Taksi', slug: 'zumrut-taksi' },
};

describe('AdminRemovalRequestsPage', () => {
  let http: HttpTestingController;
  let currentFixture: ReturnType<typeof TestBed.createComponent<AdminRemovalRequestsPage>>;

  const tick = async () => {
    for (let i = 0; i < 5; i++) {
      currentFixture.detectChanges();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [AdminRemovalRequestsPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideAppConfig(),
        {
          provide: AuthService,
          useValue: { user: signal({ id: 'admin-1', email: 'admin@example.test' }) },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AdminRemovalRequestsPage);
    currentFixture = fixture;
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('bekleyen talebi işletme adı ve sebeple listeler', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/removal_requests')).flush([REQUEST_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Zümrüt Taksi');
    expect(el.textContent).toContain('Numaramın burada olmasını istemiyorum.');
  });

  it('tamamlandı tıklanınca status=completed + resolved_by admin id ile PATCH edilir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/removal_requests')).flush([REQUEST_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const btn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Tamamlandı'),
    ) as HTMLButtonElement;
    btn.click();

    const req = http.expectOne((r) => r.url.includes('/rest/v1/removal_requests') && r.method === 'PATCH');
    expect(req.request.body).toMatchObject({ status: 'completed', resolved_by: 'admin-1' });
    req.flush(null);
    await tick();

    http.expectOne((r) => r.url.includes('/rest/v1/removal_requests')).flush([]);
    await tick();
  });
});
