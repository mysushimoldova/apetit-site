"use client";
// Шапка правовой страницы — как на сайте (DESIGN.md → Header), без чипов и
// корзины: APETIT, город (если выбран) и переключатель RO/RU, который здесь
// работает. Какая кнопка выделена, решает CSS по data-lang обёртки — так
// выделение верно с первого кадра, ещё до загрузки React.
import { HeaderCityButton } from "@/components/menu/header-city-button";
import { getCity, type Locale } from "@/data/points";
import { chooseLegalLocale } from "@/lib/legal-lang";
import { useLegalLocale, useSavedCity } from "./use-legal-locale";

const LOCALES: Locale[] = ["ro", "ru"];

export function LegalHeader({
  changeCity,
}: {
  /** Подпись кнопки города на каждом языке */
  changeCity: Record<Locale, string>;
}) {
  const locale = useLegalLocale();
  const city = useSavedCity();

  return (
    <header className="site-header glass">
      <div className="page flex h-full items-center justify-between">
        <span
          translate="no"
          className="font-display text-[26px] leading-none font-semibold tracking-[0.02em] uppercase"
        >
          APETIT
        </span>
        <div className="flex items-center gap-3">
          {city && (
            <HeaderCityButton
              cityName={getCity(city).name}
              label={changeCity[locale]}
            />
          )}
          <div className="lang-switch flex items-center font-ui text-meta font-semibold">
            {LOCALES.map((code, i) => (
              <span key={code} className="flex items-center">
                {i > 0 && (
                  <span className="text-smoke" aria-hidden="true">
                    /
                  </span>
                )}
                <button
                  type="button"
                  lang={code}
                  data-code={code}
                  aria-pressed={code === locale}
                  onClick={() => chooseLegalLocale(code)}
                >
                  {code.toUpperCase()}
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
