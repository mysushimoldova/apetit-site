"use client";
// Сохранённый город — для страниц без города в адресе (контакты, правовые):
// кнопка города в шапке и ссылка «назад в меню». На сервере (и при первой
// сверке HTML) города нет; сразу после неё React берёт значение с устройства.
import { useSyncExternalStore } from "react";
import type { CitySlug } from "@/data/points";
import { getSavedCity } from "./city-storage";

function subscribe(onChange: () => void): () => void {
  // Город сменили в другой вкладке
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function useSavedCity(): CitySlug | null {
  return useSyncExternalStore(subscribe, getSavedCity, () => null);
}
