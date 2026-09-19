// Выбранный город запоминается на устройстве (SPEC §3 шаг 1).
// Всё обёрнуто в try/catch: в приватном режиме Safari localStorage бросает
// исключение, а на сервере window нет вообще.
import { isCitySlug, type CitySlug } from "@/data/points";

export const CITY_STORAGE_KEY = "apetit.city";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function getSavedCity(): CitySlug | null {
  try {
    const value = storage()?.getItem(CITY_STORAGE_KEY);
    return value && isCitySlug(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveCity(slug: CitySlug): void {
  try {
    storage()?.setItem(CITY_STORAGE_KEY, slug);
  } catch {
    // нет места или запрещено — просто не запоминаем
  }
}

export function clearCity(): void {
  try {
    storage()?.removeItem(CITY_STORAGE_KEY);
  } catch {
    // нечего чистить — ничего не делаем
  }
}
