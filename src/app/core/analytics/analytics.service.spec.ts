import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { APP_CONFIG } from '@core/config/app-config';
import type { AppEnvironment } from '@env';
import { AnalyticsService } from './analytics.service';

const config: AppEnvironment = {
  environment: 'development',
  production: false,
  siteUrl: 'https://example.test',
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon-test-key',
};

const REAL_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function setUserAgent(value: string): void {
  Object.defineProperty(window.navigator, 'userAgent', { value, configurable: true });
}

function setup(platformId: 'browser' | 'server' = 'browser'): AnalyticsService {
  TestBed.configureTestingModule({
    providers: [
      { provide: APP_CONFIG, useValue: config },
      { provide: PLATFORM_ID, useValue: platformId },
    ],
  });
  return TestBed.inject(AnalyticsService);
}

function fetchCall(fetchSpy: ReturnType<typeof vi.fn>, index = 0): { url: string; init: RequestInit } {
  const call = fetchSpy.mock.calls[index];
  if (!call) {
    throw new Error(`fetch was not called at index ${index}`);
  }
  return { url: call[0] as string, init: call[1] as RequestInit };
}

describe('AnalyticsService', () => {
  const originalUserAgent = window.navigator.userAgent;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    setUserAgent(REAL_USER_AGENT);
    fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    setUserAgent(originalUserAgent);
    vi.unstubAllGlobals();
  });

  it('tarayıcıda işletmeye bağlı bir olayı doğru gövdeyle POST eder', () => {
    const service = setup();

    service.track({ eventType: 'call_click', businessId: 'biz-1' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const { url, init } = fetchCall(fetchSpy);
    expect(url).toBe('https://project.supabase.co/rest/v1/analytics_events');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    const headers = init.headers as Record<string, string>;
    expect(headers['apikey']).toBe('anon-test-key');
    expect(headers['Authorization']).toBe('Bearer anon-test-key');

    const body = JSON.parse(init.body as string);
    expect(body.business_id).toBe('biz-1');
    expect(body.event_type).toBe('call_click');
    expect(typeof body.session_id).toBe('string');
    expect(body.metadata).toEqual({});
  });

  it('business_id gerektirmeyen bir olayda business_id null gönderir', () => {
    const service = setup();

    service.track({ eventType: 'search_performed', metadata: { query: 'kütahya taksi' } });

    const { init } = fetchCall(fetchSpy);
    const body = JSON.parse(init.body as string);
    expect(body.business_id).toBeNull();
    expect(body.metadata).toEqual({ query: 'kütahya taksi' });
  });

  it('aynı sekmedeki ardışık track çağrılarında aynı session_id kullanılır', () => {
    const service = setup();

    service.track({ eventType: 'search_performed' });
    service.track({ eventType: 'search_performed' });

    const first = JSON.parse(fetchCall(fetchSpy, 0).init.body as string);
    const second = JSON.parse(fetchCall(fetchSpy, 1).init.body as string);
    expect(second.session_id).toBe(first.session_id);
  });

  it('SSR ortamında (PLATFORM_ID=server) hiçbir istek göndermez', () => {
    const service = setup('server');

    service.track({ eventType: 'profile_view', businessId: 'biz-1' });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('bot user-agent tespit edildiğinde istek göndermez', () => {
    setUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
    const service = setup();

    service.track({ eventType: 'profile_view', businessId: 'biz-1' });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetch reddedilse bile (ağ hatası) dışarıya hata fırlatmaz', () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    const service = setup();

    expect(() => service.track({ eventType: 'profile_view', businessId: 'biz-1' })).not.toThrow();
  });
});
