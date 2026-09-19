"use client";
// Лента чипов категорий (DESIGN.md → Category Chips): якоря на секции.
// Клик — плавный скролл к секции (без smooth при reduced-motion) и один
// оборот иконки чипа, 250ms, --ease-out (при reduced-motion — только цвет);
// активный чип меняется при скролле через IntersectionObserver: активна та
// секция, через которую проходит линия сразу под липкой шапкой и лентой.
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
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

/** Оборот иконки при нажатии на чип (задача архитектора: 250ms). */
const CHIP_SPIN_MS = 250;

/** Один оборот иконки чипа. Если она ещё крутится — не начинаем заново
 *  (иначе прыжок к 0°); при reduced-motion — без движения. */
function spinIcon(chip: HTMLElement) {
  if (prefersReducedMotion()) return;
  const icon = chip.querySelector("svg");
  if (!icon || typeof icon.animate !== "function") return;
  if (icon.getAnimations().some((a) => a.playState === "running")) return;
  const easing = getComputedStyle(document.documentElement)
    .getPropertyValue("--ease-out")
    .trim();
  icon.animate(
    [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
    { duration: CHIP_SPIN_MS, easing: easing || "ease-out" },
  );
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
      // +1px: нижний край предыдущей секции, вставшей ровно под шапку, лишь
      // касается линии — без сдвига он тоже «пересекает» её и отбирает чип
      const top = stickyOffset() + 1;
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
    spinIcon(event.currentTarget);
    section.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
    // Адрес отражает категорию, но без новой записи в истории на каждый клик
    history.replaceState(null, "", `#${slug}`);
    setActive(slug);
  };

  // Enter у ссылки и так вызывает click; Space по умолчанию листает
  // страницу — делаем его таким же нажатием на чип
  const onKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key !== " ") return;
    event.preventDefault();
    event.currentTarget.click();
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
              onKeyDown={onKeyDown}
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
