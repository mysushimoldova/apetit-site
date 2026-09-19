"use client";
// Появление плиток при скролле (DESIGN.md → Motion фаза 1): y 12→0 + opacity,
// один раз, задержка 40ms по колонкам. Плитки, которые уже на экране при
// загрузке, не анимируются. Без JS и при reduced-motion всё видно сразу.
import { useEffect, useRef, type ReactNode } from "react";

const COLUMN_DELAY_MS = 40;

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
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const gridLeft = grid.getBoundingClientRect().left;
    const pending: HTMLElement[] = [];
    for (const tile of tiles) {
      const rect = tile.getBoundingClientRect();
      if (reduce || rect.top < window.innerHeight) {
        tile.setAttribute("data-visible", "");
        continue;
      }
      const column = rect.width
        ? Math.round((rect.left - gridLeft) / rect.width)
        : 0;
      tile.style.transitionDelay = `${column * COLUMN_DELAY_MS}ms`;
      pending.push(tile);
    }
    grid.setAttribute("data-reveal-ready", "");
    if (pending.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-visible", "");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    for (const tile of pending) observer.observe(tile);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
