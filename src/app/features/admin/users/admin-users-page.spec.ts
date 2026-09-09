import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AdminUsersPage } from './admin-users-page';
import { provideAppConfig } from '@core/config/app-config';

const PROFILE_ROW = {
  id: 'user-1',
  full_name: 'Ahmet Şoför',
  phone_e164: '+905551112233',
  role: 'business_owner',
  created_at: '2026-09-01T00:00:00Z',
};

describe('AdminUsersPage', () => {
  let http: HttpTestingController;
  let currentFixture: ReturnType<typeof TestBed.createComponent<AdminUsersPage>>;

  const tick = async () => {
    for (let i = 0; i < 5; i++) {
      currentFixture.detectChanges();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [AdminUsersPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideAppConfig()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AdminUsersPage);
    currentFixture = fixture;
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('kullanıcıları ad/telefon/kayıt tarihiyle listeler', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/profiles')).flush([PROFILE_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Ahmet Şoför');
    expect(el.textContent).toContain('+905551112233');
    expect(el.textContent).toContain('E-posta ile arama şu an desteklenmiyor');
  });

  it('isimsiz kullanıcı için dürüst bir yer tutucu gösterir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/profiles')).flush([{ ...PROFILE_ROW, full_name: null }]);
    await tick();

    expect(fixture.nativeElement.textContent).toContain('İsimsiz kullanıcı');
  });

  it('rol değiştirilince PATCH gönderir ve listeyi yeniler', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/profiles')).flush([PROFILE_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const select = el.querySelector('select') as HTMLSelectElement;
    select.value = 'admin';
    select.dispatchEvent(new Event('change'));

    const req = http.expectOne((r) => r.url.includes('/rest/v1/profiles') && r.method === 'PATCH');
    expect(req.request.body).toEqual({ role: 'admin' });
    req.flush(null);
    await tick();

    http.expectOne((r) => r.url.includes('/rest/v1/profiles')).flush([{ ...PROFILE_ROW, role: 'admin' }]);
    await tick();
  });

  it('rol güncelleme hata dönerse dürüst bir mesaj gösterir (ör. R9 kendi-rolünü-değiştirme kısıtı)', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/profiles')).flush([PROFILE_ROW]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const select = el.querySelector('select') as HTMLSelectElement;
    select.value = 'admin';
    select.dispatchEvent(new Event('change'));

    http
      .expectOne((r) => r.url.includes('/rest/v1/profiles') && r.method === 'PATCH')
      .flush({ message: 'forbidden' }, { status: 403, statusText: 'Forbidden' });
    await tick();

    expect(el.textContent).toContain('Rol güncellenemedi');
  });
});
