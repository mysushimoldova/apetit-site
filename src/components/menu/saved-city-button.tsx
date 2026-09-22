"use client";
// Кнопка города в шапке страниц без города в адресе (контакты, правовые):
// показывается, только если город сохранён на устройстве.
import { getCity, type Locale } from "@/data/points";
import { useSavedCity } from "@/lib/use-saved-city";
import { HeaderCityButton } from "./header-city-button";

export function SavedCityButton({
  label,
  locale,
}: {
  label: string;
  locale: Locale;
}) {
  const city = useSavedCity();
  if (!city) return null;
  return (
    <HeaderCityButton
      cityName={getCity(city).name}
      label={label}
      locale={locale}
    />
  );
}
