"use client";
// Название города в шапке + стрелка вниз: нажатие = сменить город
// (SPEC §3 шаг 1). Пока просто забывает выбор и ведёт на экран городов;
// стеклянный оверлей смены города — позже.
import { ChevronDown } from "lucide-react";
import { useChangeCity } from "@/lib/use-change-city";

export function HeaderCityButton({
  cityName,
  label,
}: {
  cityName: string;
  label: string;
}) {
  const changeCity = useChangeCity();
  return (
    <button
      type="button"
      onClick={changeCity}
      aria-label={`${cityName} — ${label}`}
      className="inline-flex h-10 touch-manipulation items-center gap-1 rounded-pill px-2 font-ui text-label font-semibold text-ink [-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [@media(hover:hover)_and_(pointer:fine)]:hover:bg-sand"
    >
      <span>{cityName}</span>
      <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
