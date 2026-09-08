/**
 * "Yol Tarifi" bağlantısı (§50).
 *
 * MVP'de kendi harita bileşenimiz yok — yalnızca Google Maps'e yönlendiren bir
 * link. Öncelik sırası: kayıtlı `google_maps_url` > koordinat > isim araması.
 * Son seçenek koordinat olmadan bile her zaman çalışan bir link üretir.
 */
export interface DirectionsInput {
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Koordinat/URL yoksa aranacak metin, örn. "Zümrüt Taksi, Kütahya". */
  searchQuery: string;
}

export function directionsHref(input: DirectionsInput): string {
  if (input.googleMapsUrl) {
    return input.googleMapsUrl;
  }
  if (typeof input.latitude === 'number' && typeof input.longitude === 'number') {
    return `https://www.google.com/maps/dir/?api=1&destination=${input.latitude},${input.longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(input.searchQuery)}`;
}
