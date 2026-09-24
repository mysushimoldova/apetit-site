"use client";
// Язык страницы по адресу в браузере (/ru/… → русский).
//
// Нужен там, где сервер язык подсказать не может: global-not-found.tsx —
// одна страница на весь сайт, ни параметров, ни адреса она не получает.
// Остальные страницы берут язык из своего корневого layout, им это не нужно.
//
// Устроено как useSavedCity: при сборке HTML на сервере и при первой сверке
// отдаётся румынский (основной язык, SPEC §7), сразу после сверки — язык из
// адреса. Так сверка HTML не расходится.
import { useSyncExternalStore } from "react";
import type { Locale } from "@/data/points";
import { DEFAULT_LOCALE } from "@/i18n/messages";
import { parseLocalePath } from "@/i18n/routes";

/** Адрес не меняется без перезагрузки: подписываться не на что. */
function subscribe(): () => void {
  return () => {};
}

function getSnapshot(): Locale {
  return parseLocalePath(window.location.pathname).locale;
}

function getServerSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

export function useUrlLocale(): Locale {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
