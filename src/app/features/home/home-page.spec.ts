import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { HomePage } from './home-page';
import { provideAppConfig } from '@core/config/app-config';

const DISTRICTS = [
  { id: 'loc-2', slug: 'tavsanli', name: 'Tavşanlı' },
  { id: 'loc-1', slug: 'merkez', name: 'Kütahya Merkez' },
  { id: 'loc-3', slug: 'simav', name: 'Simav' },
];

describe('HomePage', () => {
  let http: HttpTestingController;
  let currentFixture: ReturnType<typeof TestBed.createComponent<HomePage>>;

  const tick = async () => {
    for (let i = 0; i < 5; i++) {
      currentFixture.detectChanges();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideAppConfig()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(HomePage);
    currentFixture = fixture;
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('Kütahya Merkez listenin başına alınır ve vurgulu (chip--active) gösterilir', async () => {
    const fixture = await setup();
    http.expectOne((r) => r.url.includes('/rest/v1/businesses')).flush([]);
    http.expectOne((r) => r.url.includes('/rest/v1/locations')).flush(DISTRICTS);
    http.expectOne((r) => r.url.includes('/rest/v1/services')).flush([]);
    await tick();

    const el = fixture.nativeElement as HTMLElement;
    const chips = Array.from(el.querySelectorAll('.chip-row')[0]?.querySelectorAll('.chip') ?? []);
    expect(chips[0]?.textContent?.trim()).toBe('Kütahya Merkez');
    expect(chips[0]?.classList.contains('chip--active')).toBe(true);
    expect(chips[1]?.classList.contains('chip--active')).toBe(false);
  });
});
