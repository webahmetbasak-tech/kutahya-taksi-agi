import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminDashboardPage } from './admin-dashboard-page';
import { provideAppConfig } from '@core/config/app-config';

describe('AdminDashboardPage', () => {
  let http: HttpTestingController;
  let currentFixture: ReturnType<typeof TestBed.createComponent<AdminDashboardPage>>;

  const tick = async () => {
    for (let i = 0; i < 5; i++) {
      currentFixture.detectChanges();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [AdminDashboardPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideAppConfig()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AdminDashboardPage);
    currentFixture = fixture;
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('dört sayımı da (işletme/talep/değerlendirme/kaldırma) doğru gösterir', async () => {
    const fixture = await setup();

    http
      .expectOne(
        (r) => r.url.includes('/rest/v1/businesses') && r.params.get('status') === 'eq.pending',
      )
      .flush([{ id: 'b1' }, { id: 'b2' }]);
    http
      .expectOne((r) => r.url.includes('/rest/v1/claims') && r.params.get('status') === 'eq.pending')
      .flush([{ id: 'c1' }]);
    http
      .expectOne((r) => r.url.includes('/rest/v1/reviews') && r.params.get('status') === 'eq.pending')
      .flush([]);
    http
      .expectOne(
        (r) => r.url.includes('/rest/v1/removal_requests') && r.params.get('status') === 'eq.pending',
      )
      .flush([{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const values = Array.from(el.querySelectorAll('.stat-card__value')).map((n) => n.textContent);
    expect(values).toEqual(['2', '1', '0', '3']);
  });

  it('her kart doğru admin ekranına linkli', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([]);
    http.expectOne((r) => r.url.includes('/rest/v1/claims')).flush([]);
    http.expectOne((r) => r.url.includes('/rest/v1/reviews')).flush([]);
    http.expectOne((r) => r.url.includes('/rest/v1/removal_requests')).flush([]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a[href^="/admin/isletmeler"]')).not.toBeNull();
    expect(el.querySelector('a[href^="/admin/talepler"]')).not.toBeNull();
    expect(el.querySelector('a[href^="/admin/degerlendirmeler"]')).not.toBeNull();
    expect(el.querySelector('a[href^="/admin/kaldirma-talepleri"]')).not.toBeNull();
  });
});
