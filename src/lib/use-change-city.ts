"use client";
// «Сменить город»: забыть выбор и вернуться на экран городов — на том же
// языке, на котором человек сейчас («/» или «/ru»).
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { Locale } from "@/data/points";
import { localePath, paths } from "@/i18n/routes";
import { clearCity } from "./city-storage";

export function useChangeCity(locale: Locale): () => void {
  const router = useRouter();
  return useCallback(() => {
    clearCity();
    router.push(localePath(locale, paths.home()));
  }, [router, locale]);
}
