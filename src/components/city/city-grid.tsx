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
    // translate="no": названия городов — как в меню, авто-перевод их не трогает
    <ul
      translate="no"
      className="flex w-full flex-col gap-3 lg:flex-row lg:flex-wrap lg:justify-center"
    >
      {CITIES.map((city, index) => (
        <li key={city.slug} className="lg:w-[200px]">
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
