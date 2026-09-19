"use client";
// «Înapoi la meniu» внизу правовой страницы: в меню сохранённого города,
// а если город не выбран — на экран городов.
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSavedCity } from "./use-legal-locale";

export function LegalBackLink({ label }: { label: string }) {
  const city = useSavedCity();
  return (
    <Link href={city ? `/${city}` : "/"} className="back-link">
      <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
      {label}
    </Link>
  );
}
