// Адреса сайта на двух языках (SPEC §7, §8): румынский — без префикса
// (/soroca), русский — с /ru (/ru/soroca). Все внутренние ссылки собираются
// здесь, чтобы язык нигде не терялся при переходах.
import type { City, CitySlug, Locale } from "@/data/points";

export const LOCALES: readonly Locale[] = ["ro", "ru"];

/** Префикс языка в адресе: ro — пустой, ru — «/ru». */
export const RU_PREFIX = "/ru";

export function isLocale(value: string): value is Locale {
  return value === "ro" || value === "ru";
}

/** «/soroca» на ro → «/soroca», на ru → «/ru/soroca»; «/» на ru → «/ru». */
export function localePath(locale: Locale, path: string): string {
  if (!path.startsWith("/")) throw new Error(`Path must start with /: ${path}`);
  if (locale === "ro") return path;
  return path === "/" ? RU_PREFIX : RU_PREFIX + path;
}

/** Разбор адреса из браузера: язык и путь без префикса. */
export function parseLocalePath(pathname: string): {
  locale: Locale;
  path: string;
} {
  // «//evil.com» дало бы ссылку на чужой сайт — лишние косые черты в начале
  // схлопываем, путь всегда остаётся своим
  pathname = "/" + pathname.replace(/\/{2,}/g, "/").replace(/^\/+/, "");
  if (pathname === RU_PREFIX || pathname.startsWith(RU_PREFIX + "/")) {
    return { locale: "ru", path: pathname.slice(RU_PREFIX.length) || "/" };
  }
  return { locale: "ro", path: pathname || "/" };
}

/** Тот же экран на другом языке — для переключателя RO/RU в шапке. */
export function switchLocalePath(pathname: string, locale: Locale): string {
  return localePath(locale, parseLocalePath(pathname).path);
}

/** Пути страниц без языка — одно место для всех ссылок. */
export const paths = {
  home: () => "/",
  city: (slug: CitySlug) => `/${slug}`,
  checkout: (slug: CitySlug) => `/${slug}/comanda`,
  confirmation: (slug: CitySlug, number: number) =>
    `/${slug}/comanda/${number}`,
  contacts: () => "/contacte",
  privacy: () => "/confidentialitate",
  terms: () => "/termeni",
} as const;

/**
 * Язык страницы города, на которую ведёт плитка (SPEC §7): на «/ru» —
 * всегда русский; на «/» — выбранный посетителем язык, иначе язык города
 * (Otaci → ru).
 */
export function cityTileLocale(
  screen: Locale,
  city: City,
  saved: Locale | null,
): Locale {
  if (screen === "ru") return "ru";
  return saved ?? city.locale;
}
