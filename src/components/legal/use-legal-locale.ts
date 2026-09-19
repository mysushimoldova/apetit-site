"use client";
// Язык правовой страницы и сохранённый город — для шапки, обёртки и
// ссылки «назад». На сервере (и при первой сверке HTML) — ro и «города нет»;
// сразу после неё React берёт значения с устройства.
import { useSyncExternalStore } from "react";
import type { CitySlug, Locale } from "@/data/points";
import { DEFAULT_LOCALE } from "@/i18n/messages";
import { getSavedCity } from "@/lib/city-storage";
import { getLegalLocale, subscribeLegalLocale } from "@/lib/legal-lang";

export function useLegalLocale(): Locale {
  return useSyncExternalStore(
    subscribeLegalLocale,
    getLegalLocale,
    () => DEFAULT_LOCALE,
  );
}

export function useSavedCity(): CitySlug | null {
  return useSyncExternalStore(subscribeLegalLocale, getSavedCity, () => null);
}
