"use client";
// Обёртка правовой страницы: data-lang решает, какая из двух версий текста
// видна (CSS .legal-root в globals.css). Первым ребёнком сервер кладёт
// скрипт, который ставит data-lang до отрисовки — поэтому здесь
// suppressHydrationWarning: атрибут в HTML может уже отличаться от «ro».
import type { ReactNode } from "react";
import { LEGAL_LANG_ATTR } from "@/lib/legal-lang";
import { useLegalLocale } from "./use-legal-locale";

export function LegalRoot({ children }: { children: ReactNode }) {
  const locale = useLegalLocale();
  return (
    <div
      className="legal-root"
      {...{ [LEGAL_LANG_ATTR]: locale }}
      suppressHydrationWarning
    >
      {children}
    </div>
  );
}
