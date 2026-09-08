import { TestBed } from '@angular/core/testing';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { SchemaService } from './schema.service';

describe('SchemaService', () => {
  let events$: Subject<unknown>;
  let service: SchemaService;

  beforeEach(() => {
    events$ = new Subject();

    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { events: events$.asObservable() } }],
    });

    service = TestBed.inject(SchemaService);
  });

  afterEach(() => {
    document.querySelectorAll('script[id^="ld-json-"]').forEach((el) => el.remove());
  });

  it('bir JSON-LD script bloğu oluşturur ve HTML olarak değil metin olarak yazar', () => {
    service.set('organization', { '@type': 'Organization', name: 'Test' });

    const script = document.getElementById('ld-json-organization');

    expect(script?.getAttribute('type')).toBe('application/ld+json');
    expect(script?.textContent).toBe('{"@type":"Organization","name":"Test"}');
  });

  it('aynı id ile tekrar set edilince YENİ script eklemez, mevcut olanı günceller', () => {
    service.set('business', { name: 'A' });
    service.set('business', { name: 'B' });

    const scripts = document.querySelectorAll('#ld-json-business');
    expect(scripts.length).toBe(1);
    expect(scripts[0]?.textContent).toBe('{"name":"B"}');
  });

  it('remove() script bloğunu kaldırır', () => {
    service.set('breadcrumb', { a: 1 });
    service.remove('breadcrumb');

    expect(document.getElementById('ld-json-breadcrumb')).toBeNull();
  });

  it('navigasyonda YENİ sayfanın tekrar SET ETMEDİĞİ eski script silinir', () => {
    service.set('business', { name: 'Zümrüt Taksi' });
    service.set('breadcrumb', { a: 1 });

    events$.next(new NavigationStart(1, '/'));
    // Yeni sayfa yalnızca breadcrumb'ı tekrar yazıyor, business'a hiç dokunmuyor.
    service.set('breadcrumb', { a: 2 });
    events$.next(new NavigationEnd(1, '/', '/'));

    expect(document.getElementById('ld-json-business')).toBeNull();
    expect(document.getElementById('ld-json-breadcrumb')).not.toBeNull();
  });

  it('navigasyon sırasında YENİDEN set edilen script SİLİNMEZ', () => {
    service.set('organization', { name: 'sabit' });

    events$.next(new NavigationStart(2, '/taksi'));
    service.set('organization', { name: 'hâlâ sabit' });
    events$.next(new NavigationEnd(2, '/taksi', '/taksi'));

    expect(document.getElementById('ld-json-organization')?.textContent).toBe(
      '{"name":"hâlâ sabit"}',
    );
  });

  it('persistent:true ile set edilen script HİÇBİR sayfa tekrar yazmasa da navigasyonda kalır', () => {
    // Organization/WebSite deseni: kök App bileşeni bunu BİR KEZ yazar,
    // sonraki hiçbir sayfa tekrar dokunmaz — yine de silinmemeli.
    service.set('organization', { name: 'Kütahya Taksi Ağı' }, { persistent: true });

    events$.next(new NavigationStart(3, '/taksi'));
    events$.next(new NavigationEnd(3, '/taksi', '/taksi'));
    events$.next(new NavigationStart(4, '/bolge'));
    events$.next(new NavigationEnd(4, '/bolge', '/bolge'));

    expect(document.getElementById('ld-json-organization')).not.toBeNull();
  });
});
