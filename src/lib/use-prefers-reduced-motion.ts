"use client";
// SSR-безопасная проверка «уменьшить движение». На сервере и при гидратации
// всегда false (совпадает с HTML с сервера), сразу после — настоящее значение.
// useReducedMotion из motion читает media query уже в первом рендере и даёт
// несовпадение SSR/клиент у людей с включённым reduced motion.
import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const getSnapshot = () => window.matchMedia(QUERY).matches;
const getServerSnapshot = () => false;

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
