import { formatPhoneDisplay, telHref, whatsappHref } from './phone';

describe('telHref', () => {
  it('E.164 numarayı tel: bağlantısına çevirir', () => {
    expect(telHref('+905551112233')).toBe('tel:+905551112233');
  });
});

describe('whatsappHref', () => {
  it('E.164 numarayı wa.me bağlantısına çevirir (+ ve boşluk temizlenir)', () => {
    expect(whatsappHref('+905551112233')).toBe('https://wa.me/905551112233');
  });

  it('numarada boşluk/parantez varsa da temizler', () => {
    expect(whatsappHref('+90 (555) 111 22 33')).toBe('https://wa.me/905551112233');
  });
});

describe('formatPhoneDisplay', () => {
  it('+90 önekli numarayı Türk gösterim biçimine çevirir', () => {
    expect(formatPhoneDisplay('+905551112233')).toBe('0555 111 22 33');
  });

  it('beklenmeyen bir uzunlukta girdiyi OLDUĞU GİBİ döner (uydurmaz)', () => {
    expect(formatPhoneDisplay('+9055511')).toBe('+9055511');
  });
});
