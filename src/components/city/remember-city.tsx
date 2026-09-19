"use client";
// Запоминает город при открытии его страницы — так работает и клик по плитке,
// и прямая ссылка из Google, и «открыть в новой вкладке».
import { useEffect } from "react";
import type { CitySlug } from "@/data/points";
import { saveCity } from "@/lib/city-storage";

export function RememberCity({ slug }: { slug: CitySlug }) {
  useEffect(() => {
    saveCity(slug);
  }, [slug]);
  return null;
}
