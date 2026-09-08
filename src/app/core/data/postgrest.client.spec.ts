import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, TransferState, makeStateKey } from '@angular/core';
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

  /**
   * Bu blok, Angular'ın yerleşik `withHttpTransferCacheOptions`'ının bu
   * projede çalışmadığı doğrulandıktan sonra elle eklenen TransferState
   * mekanizmasını test eder (bkz. postgrest.client.ts başlık yorumu).
   * "SSR'da çekilen veri hydration'da tekrar çekilmez" iddiası burada
   * kanıtlanır — kod okuyarak değil.
   */
  describe('TransferState (elle önbellekleme)', () => {
    it('tarayıcıda: önbellekte kayıt varsa HİÇBİR HTTP isteği yapılmaz ve kayıt bir kez okunduktan sonra silinir', () => {
      const transferState = TestBed.inject(TransferState);
      const key = makeStateKey<unknown>('pgrest:["list","businesses",{"select":"id"}]');
      transferState.set(key, [{ id: 'cached-1' }]);

      let result: unknown;
      client.list('businesses', { select: 'id' }).subscribe((value) => (result = value));

      http.expectNone(() => true);
      expect(result).toEqual([{ id: 'cached-1' }]);
      expect(transferState.hasKey(key)).toBe(false);
    });

    it("sunucuda: yanıtı gerçekten TransferState'e yazar", () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: APP_CONFIG, useValue: config },
          { provide: PLATFORM_ID, useValue: 'server' },
        ],
      });

      const serverClient = TestBed.inject(PostgrestClient);
      const serverHttp = TestBed.inject(HttpTestingController);
      const transferState = TestBed.inject(TransferState);

      serverClient.list('businesses', { select: 'id' }).subscribe();

      const req = serverHttp.expectOne((r) => r.url.endsWith('/rest/v1/businesses'));
      req.flush([{ id: 'server-1' }]);

      const key = makeStateKey<unknown>('pgrest:["list","businesses",{"select":"id"}]');
      expect(transferState.hasKey(key)).toBe(true);
      expect(transferState.get(key, null)).toEqual([{ id: 'server-1' }]);

      serverHttp.verify();
    });
  });
});
