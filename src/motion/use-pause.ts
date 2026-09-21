"use client";
// Пауза движка на время, пока что-то открыто (лист блюда, корзина).
// Импортирует только src/motion/pause.ts — несколько строк, весь WebGL
// остаётся в отдельном куске кода и грузится после контента.
import { useEffect } from "react";
import { pauseMotion, resumeMotion } from "./pause";

/** Пока active — движок стоит по этой причине. */
export function useMotionPause(reason: string, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    pauseMotion(reason);
    return () => resumeMotion(reason);
  }, [reason, active]);
}
