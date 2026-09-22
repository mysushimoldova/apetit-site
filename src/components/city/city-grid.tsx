"use client";
// Плитки городов. Клиентский компонент из-за анимации входа (motion).
// Язык ссылки (SPEC §7): на «/ru» — всегда русский; на «/» — тот, что
// посетитель выбрал сам переключателем (apetit.lang), иначе язык города
// (Otaci → ru). Сохранённый выбор читается после первой сверки HTML —
// сервер отдаёт адреса по умолчанию, и они же в HTML для поисковиков.
import Link from "next/link";
import { motion } from "motion/react";
import { useSyncExternalStore } from "react";
import { CITIES, type Locale } from "@/data/points";
import { cityTileLocale, localePath, paths } from "@/i18n/routes";
import { getSavedLang } from "@/lib/lang-storage";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

const MotionLink = motion.create(Link);

// Токены DESIGN.md → Motion: --ease-out и --dur-slow (420ms — экран городов).
const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;
const DURATION = 0.42;
const STAGGER = 0.06;

const noop = () => () => {};

export function CityGrid({ locale }: { locale: Locale }) {
  const reduceMotion = usePrefersReducedMotion();
  const saved = useSyncExternalStore(noop, getSavedLang, () => null);

  return (
    // translate="no": названия городов — как в меню, авто-перевод их не трогает.
    // Телефон — столбик; десктоп — 3 колонки по 1fr (ряд 3 + ряд 2), DESIGN 2.1.
    <ul translate="no" className="grid w-full grid-cols-1 gap-3 lg:grid-cols-3">
      {CITIES.map((city, index) => {
        const href = localePath(
          cityTileLocale(locale, city, saved),
          paths.city(city.slug),
        );
        return (
          <li key={city.slug}>
            {reduceMotion ? (
              // «Уменьшить движение» — без анимации вообще, обычная ссылка
              <Link href={href} className="city-tile">
                {city.name}
              </Link>
            ) : (
              <MotionLink
                href={href}
                className="city-tile"
                // Полная строка transform вместо `y`: так анимация идёт на GPU
                // и не роняет кадры, пока страница ещё грузится.
                initial={{ opacity: 0, transform: "translateY(24px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                transition={{
                  duration: DURATION,
                  ease: EASE_OUT,
                  delay: index * STAGGER,
                }}
              >
                {city.name}
              </MotionLink>
            )}
          </li>
        );
      })}
    </ul>
  );
}
