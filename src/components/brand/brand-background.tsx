"use client";
// Фирменные контурные линии за контентом (DESIGN.md → Background) — на экране
// городов, в меню и на оформлении. Неподвижный слой на весь экран, клики
// проходят сквозь него. При прокрутке линии едут вверх на 0.35 от прокрутки:
// меняется только transform, без перерисовки. При «уменьшить движение» —
// слой стоит на месте. Прозрачность — переменная --bg-lines-opacity.
//
// Из Motion берём только useScroll: компонент motion.div тянет в меню ещё
// ~44 КБ скриптов, и страница оживает позже (Lighthouse −2…3 балла).
// Сдвиг пишем в style.transform сами — React при прокрутке не участвует.
import { useEffect, useRef } from "react";
import { useScroll } from "motion/react";
import { bgOffset } from "@/lib/bg-parallax";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

export function BrandBackground() {
  const reduce = usePrefersReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (reduce) {
      track.style.transform = "";
      return;
    }
    // Высота двух экранов слоя (обычный + зеркальный) — период повтора.
    // Меряем при старте и при изменении размера экрана, не на каждом кадре.
    let period = 0;
    const apply = (y: number) => {
      track.style.transform = `translate3d(0, ${bgOffset(y, period)}px, 0)`;
    };
    const measure = () => {
      period = (track.offsetHeight * 2) / 3;
      apply(scrollY.get());
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    const unsubscribe = scrollY.on("change", apply);
    return () => {
      observer.disconnect();
      unsubscribe();
    };
  }, [scrollY, reduce]);

  return (
    <div className="brand-bg" aria-hidden="true" data-brand-bg="">
      <div ref={trackRef} className="brand-bg-track">
        <div className="brand-bg-tile" />
        <div className="brand-bg-tile brand-bg-tile-flip" />
        <div className="brand-bg-tile" />
      </div>
    </div>
  );
}
