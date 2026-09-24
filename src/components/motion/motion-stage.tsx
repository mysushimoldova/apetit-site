"use client";
// Движок анимаций на странице (src/motion/engine.ts). Сам холст создаёт
// движок; этот компонент только решает, когда его подгружать.
//
// Подгружаем после контента: сначала страница показана и нарисован первый
// кадр, только потом запрашивается код движка (dynamic import, ssr:false).
// На скорость показа страницы (LCP) он не влияет, холст проявляется за
// 320 мс (globals.css → .motion-canvas, --dur-in).
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const MotionRuntime = dynamic(() => import("./motion-runtime"), { ssr: false });

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

export function MotionStage({
  splashProducts,
  splashPhotos,
}: {
  /** Блюда этой страницы — нужны заставке категории (только меню). */
  splashProducts?: readonly string[];
  splashPhotos?: Readonly<Record<string, string>>;
}) {
  const [load, setLoad] = useState(false);
  useEffect(() => afterFirstPaint(() => setLoad(true)), []);
  return load ? (
    <MotionRuntime
      splashProducts={splashProducts}
      splashPhotos={splashPhotos}
    />
  ) : null;
}
