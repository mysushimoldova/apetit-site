"use client";
// Лента чипов категорий (DESIGN.md → Category Chips): якоря на секции.
// Клик — плавный скролл к секции (без smooth при reduced-motion) и один
// оборот иконки чипа, 200ms, --ease-out (при reduced-motion — только цвет);
// активный чип меняется при скролле через IntersectionObserver: активна та
// секция, через которую проходит линия сразу под липкой шапкой и лентой.
// Пока страница сама едет к выбранной категории, активным остаётся её чип:
// промежуточные категории по дороге не загораются.
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { CategoryIcon } from "@/components/icons/category-icon";
import { watchProgrammaticScroll } from "@/lib/programmatic-scroll";
import { pauseMotion, resumeMotion } from "@/motion/pause";
import { requestSplash } from "@/motion/splash/request";

/** Причина паузы движка на время прокрутки к категории. */
const SCROLL_PAUSE = "scroll";

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

/** Секция, через которую проходит линия активности (как у observer). */
function sectionAtLine(items: ChipItem[]): string | undefined {
  const line = stickyOffset() + 2;
  return items.find((item) => {
    const rect = document.getElementById(item.slug)?.getBoundingClientRect();
    return rect && rect.top <= line && rect.bottom > line;
  })?.slug;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Оборот иконки при нажатии на чип. 200 мс — смена состояния по шкале
 *  docs/MOTION.md §2 (решение архитектора 24.09.2026, было 250). */
const CHIP_SPIN_MS = 200;

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
  // Идёт программная прокрутка к чипу: observer не трогает активный чип.
  // Хранит отмену ожидания конца прокрутки.
  const scrollLockRef = useRef<(() => void) | null>(null);

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
          if (scrollLockRef.current) return;
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
    // Фиксацию чипа здесь не снимаем: клик мог прийти раньше, чем React
    // запустил эффекты (он повторяет такой клик после «оживления» страницы),
    // и уборка при повторном запуске эффекта сняла бы свежую фиксацию.
    // Ожидание конца прокрутки само заканчивается не позже SCROLL_START_MS.
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

    // Заставка категории (docs/motion/splash-prompt.md). Если она играет,
    // страница переходит к категории мгновенно — под заставкой: когда та
    // уйдёт, сетка уже на месте и ничего не «доезжает» на глазах.
    // Заставки нет (нет роликов, слабый телефон, «уменьшить движение») —
    // всё как раньше: плавный проезд и пауза движка на время него.
    const word = items.find((item) => item.slug === slug)?.label ?? "";
    if (requestSplash({ category: slug, word })) {
      section.scrollIntoView({ behavior: "auto", block: "start" });
      history.replaceState(null, "", `#${slug}`);
      setActive(slug);
      return;
    }

    section.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
    // Адрес отражает категорию, но без новой записи в истории на каждый клик
    history.replaceState(null, "", `#${slug}`);
    setActive(slug);
    // Фиксируем выбранный чип до конца прокрутки. Если человек прервал её
    // сам — активна та секция, где страница остановилась; иначе — выбранная
    // (даже если последняя секция не доехала до шапки: ниже листать некуда).
    // На время этой прокрутки движок анимаций стоит: пока страница едет,
    // телефону есть чем заняться и без фона (src/motion/pause.ts). Ожидание
    // само кончается не позже SCROLL_START_MS, поэтому паузу всегда кто-то
    // снимет — даже если человек успел уйти со страницы.
    scrollLockRef.current?.();
    pauseMotion(SCROLL_PAUSE);
    const stopWatch = watchProgrammaticScroll(window, (interrupted) => {
      scrollLockRef.current = null;
      resumeMotion(SCROLL_PAUSE);
      if (!interrupted) return;
      const current = sectionAtLine(items);
      if (current) setActive(current);
    });
    scrollLockRef.current = () => {
      scrollLockRef.current = null;
      stopWatch();
      resumeMotion(SCROLL_PAUSE);
    };
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
