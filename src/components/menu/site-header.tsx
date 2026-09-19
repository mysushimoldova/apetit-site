// Шапка меню (DESIGN.md → Header): 56px, стекло, снизу линия. Слева APETIT
// (пока текстом Oswald — SVG-логотипа ещё нет), справа город + RO/RU.
// Переключатель языка пока статический: маршрут /ru/[city] (SPEC §7) —
// следующая задача.
// Десктоп: справа ещё кнопка корзины (DESIGN.md → Layout).
import { HeaderCartButton } from "@/components/cart/header-cart-button";
import type { City, Locale } from "@/data/points";
import type { Messages } from "@/i18n/messages";
import { HeaderCityButton } from "./header-city-button";

const LOCALES: Locale[] = ["ro", "ru"];

export function SiteHeader({
  city,
  locale,
  t,
}: {
  city: City;
  locale: Locale;
  t: Messages;
}) {
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
          <HeaderCityButton cityName={city.name} label={t.header.changeCity} />
          <span className="font-ui text-meta font-semibold" aria-hidden="true">
            {LOCALES.map((code, i) => (
              <span key={code}>
                {i > 0 && <span className="text-smoke"> / </span>}
                <span className={code === locale ? "text-ink" : "text-smoke"}>
                  {code.toUpperCase()}
                </span>
              </span>
            ))}
          </span>
          <HeaderCartButton />
        </div>
      </div>
    </header>
  );
}
