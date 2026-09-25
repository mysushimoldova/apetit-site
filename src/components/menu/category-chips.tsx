"use client";
// Лента чипов категорий (DESIGN.md → Category Chips): якоря на секции.
// Клик — плавный скролл к секции (без smooth при reduced-motion); сам чип
// при этом не двигается: чипы не анимируются вовсе (docs/MOTION.md §4,
// решение архитектора 24.09.2026 — оборот иконки убран). Активный чип
// меняется при скролле через IntersectionObserver: активна та секция,
// через которую проходит линия сразу под липкой шапкой и лентой.
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
  // Номер последнего нажатия: запоздалый ответ заставки о прошлом нажатии
  // не должен увести страницу от категории, выбранной после него
  const clickRef = useRef(0);

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
    const click = ++clickRef.current;

    // Заставка категории (docs/motion/splash-prompt.md). Если она играет,
    // страница переходит к категории мгновенно — под заставкой: когда та
    // уйдёт, сетка уже на месте и ничего не «доезжает» на глазах.
    // Заставки нет (нет роликов, слабый телефон, «уменьшить движение») —
    // всё как раньше: плавный проезд и пауза движка на время него.
    // Блюдо ещё догружается — ответ придёт чуть позже (не дольше 150 мс);
    // если за это время нажали другой чип, решает уже он.
    const word = items.find((item) => item.slug === slug)?.label ?? "";
    const answer = requestSplash({ category: slug, word, url: `#${slug}` });
    if (answer === true) jump(section, slug);
    else if (answer === false) glide(section, slug);
    else {
      void answer.then((played) => {
        if (click !== clickRef.current) return;
        if (played) jump(section, slug);
        else glide(section, slug);
      });
    }
  };

  /** Переход под заставкой: мгновенный, заставка закрывает его собой. */
  const jump = (section: HTMLElement, slug: string) => {
    scrollLockRef.current?.();
    section.scrollIntoView({ behavior: "auto", block: "start" });
    history.replaceState(null, "", `#${slug}`);
    setActive(slug);
    // Как и при проезде, чип выбранной категории держится: у нижних
    // категорий (desert, sosuri) страница не может встать так, чтобы секция
    // оказалась под шапкой, и observer после прыжка зажёг бы соседнюю.
    // Держим, пока человек сам не тронет страницу. Касание заставки
    // (pointerdown) не в счёт — это не прокрутка.
    const events = ["wheel", "touchstart", "keydown"];
    const release = () => {
      clearTimeout(arm);
      for (const type of events) window.removeEventListener(type, release);
      if (scrollLockRef.current === release) scrollLockRef.current = null;
    };
    // Со следующего цикла: нажатие, которое привело сюда (Enter на чипе —
    // это keydown), ещё всплывает до window
    const arm = setTimeout(() => {
      for (const type of events)
        window.addEventListener(type, release, { passive: true });
    }, 0);
    scrollLockRef.current = release;
  };

  /** Обычный переход без заставки: плавный проезд к категории. */
  const glide = (section: HTMLElement, slug: string) => {
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
