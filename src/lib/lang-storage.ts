// Язык, который посетитель выбрал сам переключателем RO/RU (SPEC §7:
// выбор запоминается на устройстве). Просто открыть /ru/otaci — не выбор:
// это язык города по умолчанию. Сохранённый язык решает, на каком языке
// откроются плитки на «/» и редирект с «/» на сохранённый город.
// Всё в try/catch: приватный режим Safari бросает исключение, на сервере
// window нет.
import type { Locale } from "@/data/points";
import { isLocale } from "@/i18n/routes";

export const LANG_STORAGE_KEY = "apetit.lang";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function getSavedLang(): Locale | null {
  try {
    const value = storage()?.getItem(LANG_STORAGE_KEY);
    return value && isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveLang(locale: Locale): void {
  try {
    storage()?.setItem(LANG_STORAGE_KEY, locale);
  } catch {
    // нет места или запрещено — просто не запоминаем
  }
}
