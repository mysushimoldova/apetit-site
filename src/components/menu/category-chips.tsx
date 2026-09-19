"use client";
// Лента чипов категорий (DESIGN.md → Category Chips): якоря на секции.
// Клик — плавный скролл к секции (без smooth при reduced-motion);
// активный чип меняется при скролле через IntersectionObserver: активна та
// секция, через которую проходит линия сразу под липкой шапкой и лентой.
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { CategoryIcon } from "@/components/icons/category-icon";

export interface ChipItem {
  slug: string;
  label: string;
  icon: string;
}

/** Высота липкой шапки + ленты: под ней проходит «линия активности». */
function stickyOffset(): number {
  const root = getComputedStyle(document.documentElement);
  return (
    parseFloat(root.getPropertyValue("--size-header")) +
    parseFloat(root.getPropertyValue("--size-chips-row"))
  );
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CategoryChips({
  items,
  label,
}: {
  items: ChipItem[];
  label: string;
}) {
  const [active, setActive] = useState<string>(items[0]?.slug ?? "");
  const navRef = useRef<HTMLElement>(null);

  // Активная секция — та, что пересекает линию под шапкой
  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    const observe = () => {
      observer?.disconnect();
      const top = stickyOffset();
      const bottom = Math.max(0, window.innerHeight - top - 2);
      observer = new IntersectionObserver(
        (entries) => {
          const hit = entries.find((e) => e.isIntersecting);
          if (hit) setActive(hit.target.id);
        },
        { rootMargin: `-${top}px 0px -${bottom}px 0px`, threshold: 0 },
      );
      for (const item of items) {
        const el = document.getElementById(item.slug);
        if (el) observer.observe(el);
      }
    };
    observe();
    window.addEventListener("resize", observe);
    return () => {
      window.removeEventListener("resize", observe);
      observer?.disconnect();
    };
  }, [items]);

  // Активный чип всегда виден в ленте (прокручиваем только ленту, не страницу)
  useEffect(() => {
    const nav = navRef.current;
    const chip = nav?.querySelector<HTMLElement>(`[data-slug="${active}"]`);
    if (!nav || !chip) return;
    const left = chip.offsetLeft - (nav.clientWidth - chip.offsetWidth) / 2;
    nav.scrollTo({
      left,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [active]);

  const onClick = (event: MouseEvent<HTMLAnchorElement>, slug: string) => {
    const section = document.getElementById(slug);
    if (!section) return; // без секции сработает обычный якорь
    event.preventDefault();
    section.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
    // Адрес отражает категорию, но без новой записи в истории на каждый клик
    history.replaceState(null, "", `#${slug}`);
    setActive(slug);
  };

  return (
    <nav ref={navRef} aria-label={label} className="chips-row glass">
      <ul className="flex h-full w-max items-center gap-2">
        {items.map((item) => (
          <li key={item.slug} className="shrink-0">
            <a
              href={`#${item.slug}`}
              data-slug={item.slug}
              aria-current={active === item.slug ? "true" : undefined}
              onClick={(e) => onClick(e, item.slug)}
              className="chip"
            >
              <CategoryIcon name={item.icon} />
              <span>{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
