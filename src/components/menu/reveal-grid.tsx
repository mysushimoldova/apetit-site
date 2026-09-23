"use client";
// Появление карточек блюд при прокрутке (DESIGN.md → Motion фаза 1). Сам
// эффект — в globals.css (.food-reveal, .food-shadow); здесь только решается,
// кому и когда его включать:
//
//  • карточки, видные сразу при загрузке, показываем в покое — иначе первый
//    экран мигает, а это ещё и главная картинка страницы (LCP);
//  • остальным задержка по колонкам слева направо (--pv-delay), чтобы ряд
//    появлялся волной, а не разом;
//  • пока страница сама едет к категории (нажали чип), карточки показываем
//    без анимации: их проносит мимо экрана, и мигание было бы сплошным.
//
// Каждая карточка появляется один раз: после показа наблюдатель её отпускает.
import { useEffect, useRef, type ReactNode } from "react";
import { motionPauseReasons } from "@/motion/pause";

/** Причина паузы движка, под которой страница сама едет к категории
 *  (src/components/menu/category-chips.tsx). */
const SCROLL_PAUSE = "scroll";

/** Сколько колонок ждут своей очереди (docs/MOTION.md §2): на компьютере
 *  четвёртая карточка ряда появляется вместе с третьей — длинный каскад
 *  выглядит дёшево. */
const MAX_DELAYED_COLUMNS = 2;

/** Задержка между колонками, мс. Приходит из src/config/motion.json
 *  переменной CSS — панель /dev/motion меняет её на живой странице. */
function columnDelay(grid: HTMLElement): number {
  const value = getComputedStyle(grid).getPropertyValue("--pv-stagger");
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function RevealGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    const tiles = Array.from(
      grid.querySelectorAll<HTMLElement>("[data-reveal]"),
    );

    const stagger = columnDelay(grid);
    const gridLeft = grid.getBoundingClientRect().left;
    const pending: HTMLElement[] = [];
    for (const tile of tiles) {
      const rect = tile.getBoundingClientRect();
      if (rect.top < window.innerHeight) {
        tile.setAttribute("data-visible", "");
        continue;
      }
      const column = rect.width
        ? Math.round((rect.left - gridLeft) / rect.width)
        : 0;
      const step = Math.min(column, MAX_DELAYED_COLUMNS);
      tile.style.setProperty("--pv-delay", `${step * stagger}ms`);
      // Прятать — без перехода: иначе фото, которое ещё никто не видел,
      // сперва плавно погасло бы. Переход возвращаем через кадр.
      tile.setAttribute("data-instant", "");
      pending.push(tile);
    }
    grid.setAttribute("data-reveal-ready", "");
    if (pending.length === 0) return;
    const restore = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        for (const tile of pending) tile.removeAttribute("data-instant");
      }),
    );

    const observer = new IntersectionObserver(
      (entries) => {
        const moving = motionPauseReasons().includes(SCROLL_PAUSE);
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (moving) entry.target.setAttribute("data-instant", "");
          entry.target.setAttribute("data-visible", "");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -6% 0px" },
    );
    for (const tile of pending) observer.observe(tile);
    return () => {
      cancelAnimationFrame(restore);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
