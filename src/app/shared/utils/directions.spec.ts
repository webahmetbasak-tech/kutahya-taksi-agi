import { directionsHref } from './directions';

describe('directionsHref', () => {
  it('google_maps_url varsa onu doğrudan döner (öncelik 1)', () => {
    const href = directionsHref({
      googleMapsUrl: 'https://maps.app.goo.gl/deneme',
      latitude: 39.42,
      longitude: 29.98,
      searchQuery: 'Zümrüt Taksi, Kütahya',
    });

    expect(href).toBe('https://maps.app.goo.gl/deneme');
  });

  it('google_maps_url yoksa ama koordinat varsa mesafe linki üretir (öncelik 2)', () => {
    const href = directionsHref({
      latitude: 39.42,
      longitude: 29.98,
      searchQuery: 'Zümrüt Taksi, Kütahya',
    });

    expect(href).toBe('https://www.google.com/maps/dir/?api=1&destination=39.42,29.98');
  });

  it('ne URL ne koordinat varsa isim araması linki üretir — her zaman bir link döner', () => {
    const href = directionsHref({ searchQuery: 'Zümrüt Taksi, Kütahya' });

    expect(href).toBe(
      'https://www.google.com/maps/search/?api=1&query=Z%C3%BCmr%C3%BCt%20Taksi%2C%20K%C3%BCtahya',
    );
  });

  it('yalnızca enlem varsa (boylam eksik) koordinat linkini kullanmaz', () => {
    const href = directionsHref({ latitude: 39.42, searchQuery: 'Kütahya' });

    expect(href).toContain('/maps/search/');
  });
});
