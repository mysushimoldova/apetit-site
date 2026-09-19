// Язык правовых страниц (/confidentialitate, /termeni). У них нет города
// в адресе, поэтому язык — по сохранённому городу, как на остальном сайте:
// Otaci → ru, остальные и «город не выбран» → ro (SPEC §7). Переключатель
// RO/RU в шапке меняет язык на месте, без перезагрузки.
//
// Обе версии текста уже есть в HTML (страницы статические), видна одна —
// по атрибуту data-lang на обёртке. При обычном открытии его ставит
// крошечный скрипт ДО отрисовки (как city-redirect-script.ts), поэтому
// русский текст для Otaci не мигает румынским. При переходе по ссылке
// внутри сайта скрипт не выполняется — язык ставит React (useLegalLocale).
import { CITIES, type Locale } from "@/data/points";
import { DEFAULT_LOCALE } from "@/i18n/messages";
import { CITY_STORAGE_KEY, getSavedCity } from "./city-storage";

export const LEGAL_LANG_ATTR = "data-lang";

/** Язык по slug сохранённого города; неизвестный или пустой → ro. */
export function localeForSavedCity(slug: string | null): Locale {
  return CITIES.find((c) => c.slug === slug)?.locale ?? DEFAULT_LOCALE;
}

/**
 * Текст инлайн-скрипта: первый ребёнок обёртки, выставляет ей data-lang.
 * Собирается из наших констант — пользовательских данных в нём нет;
 * значение из хранилища сравнивается со списком городов, а не вставляется.
 */
export function buildLegalLangScript(): string {
  const map = Object.fromEntries(CITIES.map((c) => [c.slug, c.locale]));
  return (
    "try{" +
    `var m=${JSON.stringify(map)};` +
    `var c=localStorage.getItem(${JSON.stringify(CITY_STORAGE_KEY)});` +
    "if(c&&Object.prototype.hasOwnProperty.call(m,c))" +
    `document.currentScript.parentNode.setAttribute(${JSON.stringify(LEGAL_LANG_ATTR)},m[c])` +
    "}catch(e){}"
  );
}

// Выбор на переключателе живёт, пока открыта вкладка (переходы между
// правовыми страницами его сохраняют), и не меняет сохранённый город.
let chosen: Locale | null = null;
const listeners = new Set<() => void>();

export function subscribeLegalLocale(onChange: () => void): () => void {
  listeners.add(onChange);
  // Город сменили в другой вкладке — язык тоже мог смениться
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getLegalLocale(): Locale {
  return chosen ?? localeForSavedCity(getSavedCity());
}

export function chooseLegalLocale(locale: Locale): void {
  chosen = locale;
  listeners.forEach((fn) => fn());
}

/** Только для тестов: сбросить выбор переключателя. */
export function resetLegalLocaleForTests(): void {
  chosen = null;
}
