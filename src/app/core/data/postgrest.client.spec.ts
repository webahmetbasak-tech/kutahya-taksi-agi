import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PostgrestClient } from './postgrest.client';
import { APP_CONFIG } from '@core/config/app-config';
import type { AppEnvironment } from '@env';

const config: AppEnvironment = {
  environment: 'development',
  production: false,
  siteUrl: 'https://example.test',
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon-test-key',
};

describe('PostgrestClient', () => {
  let client: PostgrestClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: config },
      ],
    });
    client = TestBed.inject(PostgrestClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('anon anahtarı hem apikey hem Authorization başlığında gönderir', () => {
    client.list('businesses').subscribe();

    const req = http.expectOne((r) => r.url === 'https://project.supabase.co/rest/v1/businesses');

    expect(req.request.headers.get('apikey')).toBe('anon-test-key');
    expect(req.request.headers.get('Authorization')).toBe('Bearer anon-test-key');
    req.flush([]);
  });

  it('sorgu parametrelerini PostgREST filtre sözdizimiyle yollar', () => {
    client.list('businesses', { select: 'id,slug', status: 'eq.active' }).subscribe();

    const req = http.expectOne(
      (r) =>
        r.url === 'https://project.supabase.co/rest/v1/businesses' &&
        r.params.get('select') === 'id,slug' &&
        r.params.get('status') === 'eq.active',
    );
    req.flush([]);
  });

  it('single(): sonuç varsa ilk satırı döner', async () => {
    const promise = new Promise((resolve) => {
      client.single('businesses', { slug: 'eq.zumrut-taksi' }).subscribe(resolve);
    });

    const req = http.expectOne((r) => r.params.get('limit') === '1');
    req.flush([{ id: '1', slug: 'zumrut-taksi' }]);

    await expect(promise).resolves.toEqual({ id: '1', slug: 'zumrut-taksi' });
  });

  it('single(): boş sonuçta null döner (silinmiş işletme normal bir durumdur)', async () => {
    const promise = new Promise((resolve) => {
      client.single('businesses', { slug: 'eq.olmayan-slug' }).subscribe(resolve);
    });

    const req = http.expectOne((r) => r.params.get('limit') === '1');
    req.flush([]);

    await expect(promise).resolves.toBeNull();
  });

  it('undefined değerli parametreleri atlar', () => {
    client.list('businesses', { select: 'id', district: undefined }).subscribe();

    const req = http.expectOne((r) => r.url === 'https://project.supabase.co/rest/v1/businesses');

    expect(req.request.params.has('district')).toBe(false);
    req.flush([]);
  });

  it('insert(): Prefer: return=minimal gönderir (yazma yanıtı beklenmez)', () => {
    client.insert('analytics_events', { event_type: 'profile_view' }).subscribe();

    const req = http.expectOne('https://project.supabase.co/rest/v1/analytics_events');

    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Prefer')).toBe('return=minimal');
    req.flush(null);
  });
});
