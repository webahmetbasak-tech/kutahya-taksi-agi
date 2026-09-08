import { formatPhoneDisplay, normalizeTrPhone, telHref, whatsappHref } from './phone';

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

describe('normalizeTrPhone', () => {
  it('baştan sıfırlı 11 haneli numarayı E.164e çevirir', () => {
    expect(normalizeTrPhone('05551112233')).toBe('+905551112233');
  });

  it('baştan sıfırsız 10 haneli numarayı E.164e çevirir', () => {
    expect(normalizeTrPhone('5551112233')).toBe('+905551112233');
  });

  it('zaten E.164 olan numarayı olduğu gibi tanır', () => {
    expect(normalizeTrPhone('+905551112233')).toBe('+905551112233');
  });

  it('0090 uluslararası önekini çözer', () => {
    expect(normalizeTrPhone('00905551112233')).toBe('+905551112233');
  });

  it('boşluk/parantez/tire içeren girdiyi temizleyerek çözer', () => {
    expect(normalizeTrPhone('0555 111 22 33')).toBe('+905551112233');
    expect(normalizeTrPhone('(0555) 111-22-33')).toBe('+905551112233');
  });

  it('tanınmayan bir biçimde null döner (uydurma numara üretmez)', () => {
    expect(normalizeTrPhone('123')).toBeNull();
    expect(normalizeTrPhone('abc')).toBeNull();
  });
});
