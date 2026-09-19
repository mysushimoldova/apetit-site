"use client";
// Фирменные контурные линии за контентом (DESIGN.md → Background) — на экране
// городов, в меню и на оформлении. Неподвижный слой на весь экран, клики
// проходят сквозь него. При прокрутке линии едут вверх на 0.35 от прокрутки:
// меняется только transform, без перерисовки. При «уменьшить движение» —
// слой стоит на месте. Прозрачность — переменная --bg-lines-opacity.
//
// Картинка декоративная и тяжёлая (плитка 3200×1800): запрашиваем её только
// после загрузки страницы и первого кадра — она не задерживает показ меню.
//
// Без Motion: для сдвига нужна только позиция прокрутки, а Motion тянул в
// меню ~14 КБ скриптов. Слушатель scroll (passive) + один requestAnimationFrame
// на кадр; сдвиг пишем в style.transform сами — React при прокрутке не участвует.
import { useEffect, useRef } from "react";
import { bgOffset, bgTileHeight } from "@/lib/bg-parallax";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

/** Та же картинка, что в globals.css (.brand-bg[data-ready] .brand-bg-track). */
const BG_SRC = "/img/bg/linii.webp";

/** Страница загружена и один кадр уже нарисован → callback. */
function afterFirstPaint(callback: () => void): () => void {
  let raf = 0;
  const start = () => {
    // Два requestAnimationFrame: второй срабатывает уже после отрисовки
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(callback);
    });
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
  return () => {
    window.removeEventListener("load", start);
    cancelAnimationFrame(raf);
  };
}

export function BrandBackground() {
  const reduce = usePrefersReducedMotion();
  const layerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Картинку — после контента; показываем, когда она готова (без «проявки
  // по кускам»). Ошибка загрузки — тоже data-ready: слой просто пустой.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    let cancelled = false;
    const cancel = afterFirstPaint(() => {
      const img = new Image();
      img.src = BG_SRC;
      const show = () => {
        if (!cancelled) layer.setAttribute("data-ready", "");
      };
      img.decode().then(show, show);
    });
    return () => {
      cancelled = true;
      cancel();
    };
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (reduce) {
      track.style.transform = "";
      return;
    }
    // Период повтора — высота плитки. Меряем при старте и при изменении
    // размера экрана, не на каждом кадре.
    let period = 0;
    let raf = 0;
    const apply = () => {
      raf = 0;
      track.style.transform = `translate3d(0, ${bgOffset(window.scrollY, period)}px, 0)`;
    };
    // Не чаще одного раза за кадр, сколько бы событий scroll ни пришло
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const measure = () => {
      const frameWidth = parseFloat(
        getComputedStyle(track).getPropertyValue("--bg-frame-w"),
      );
      period = bgTileHeight(frameWidth);
      apply();
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [reduce]);

  return (
    <div
      ref={layerRef}
      className="brand-bg"
      aria-hidden="true"
      data-brand-bg=""
    >
      <div ref={trackRef} className="brand-bg-track" />
    </div>
  );
}
