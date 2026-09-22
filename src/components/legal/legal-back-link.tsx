"use client";
// «Înapoi la meniu» внизу правовой страницы: в меню сохранённого города
// (на текущем языке), а если город не выбран — на экран городов.
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Locale } from "@/data/points";
import { localePath, paths } from "@/i18n/routes";
import { useSavedCity } from "@/lib/use-saved-city";

export function LegalBackLink({
  label,
  locale,
}: {
  label: string;
  locale: Locale;
}) {
  const city = useSavedCity();
  return (
    <Link
      href={localePath(locale, city ? paths.city(city) : paths.home())}
      className="back-link"
    >
      <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
      {label}
    </Link>
  );
}
