// Расстояние от человека до точки (SPEC §3 шаг 5, §9.1: «браузерная
// геолокация + расчёт своими силами», без Google Maps API).
import type { Locale } from "@/data/points";

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** По прямой (гаверсинус) — для «~1,2 km» точности хватает. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

/** «~1,2 km»; от 10 km — без десятых; меньше 100 м — «~0,1». */
export function formatKm(locale: Locale, km: number, unit: string): string {
  const value = Math.max(km, 0.1);
  const digits = value >= 10 ? 0 : 1;
  const text = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
  return `~${text} ${unit}`;
}
