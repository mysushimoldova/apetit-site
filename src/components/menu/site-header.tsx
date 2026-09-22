// Шапка (DESIGN.md → Header): 56px, стекло, снизу линия. Слева APETIT
// (пока текстом Oswald — SVG-логотипа ещё нет), справа город + RO/RU.
// city — страницы города (меню, оформление, подтверждение); без city
// (контакты, правовые) город берётся из памяти устройства, если выбран.
// Десктоп: справа ещё кнопка корзины (DESIGN.md → Layout) — только в меню
// (cart); на оформлении заказа корзина уже на экране.
import { HeaderCartButton } from "@/components/cart/header-cart-button";
import type { City, Locale } from "@/data/points";
import type { Messages } from "@/i18n/messages";
import { HeaderCityButton } from "./header-city-button";
import { LangSwitch } from "./lang-switch";
import { SavedCityButton } from "./saved-city-button";

export function SiteHeader({
  city,
  locale,
  t,
  cart = false,
}: {
  city?: City;
  locale: Locale;
  t: Messages;
  cart?: boolean;
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
          {city ? (
            <HeaderCityButton
              cityName={city.name}
              label={t.header.changeCity}
              locale={locale}
            />
          ) : (
            <SavedCityButton label={t.header.changeCity} locale={locale} />
          )}
          <LangSwitch locale={locale} label={t.header.language} />
          {cart && <HeaderCartButton />}
        </div>
      </div>
    </header>
  );
}
