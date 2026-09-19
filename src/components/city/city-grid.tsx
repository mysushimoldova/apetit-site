"use client";
// Пять плиток городов. Клиентский компонент из-за анимации входа (motion).
import Link from "next/link";
import { motion } from "motion/react";
import { CITIES } from "@/data/points";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

const MotionLink = motion.create(Link);

// Токены DESIGN.md → Motion: --ease-out и --dur-slow (420ms — экран городов).
const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;
const DURATION = 0.42;
const STAGGER = 0.06;

export function CityGrid() {
  const reduceMotion = usePrefersReducedMotion();

  return (
    // translate="no": названия городов — как в меню, авто-перевод их не трогает.
    // Телефон — столбик; десктоп — 3 колонки по 1fr (ряд 3 + ряд 2), DESIGN 2.1.
    <ul translate="no" className="grid w-full grid-cols-1 gap-3 lg:grid-cols-3">
      {CITIES.map((city, index) => (
        <li key={city.slug}>
          {reduceMotion ? (
            // «Уменьшить движение» — без анимации вообще, обычная ссылка
            <Link href={`/${city.slug}`} className="city-tile">
              {city.name}
            </Link>
          ) : (
            <MotionLink
              href={`/${city.slug}`}
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
      ))}
    </ul>
  );
}
