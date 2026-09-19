"use client";
// «Открыто ли сейчас» для показа (баннер, неактивная кнопка). Решает сервер —
// здесь только часы телефона. Перепроверка раз в 30 секунд: страница может
// быть открыта в 22:59. До гидратации — null (неизвестно, ничего не рисуем).
import { useCallback, useSyncExternalStore } from "react";
import { isOpenAt, type Hours } from "./hours";

const CHECK_EVERY_MS = 30_000;

function subscribe(onChange: () => void) {
  const timer = window.setInterval(onChange, CHECK_EVERY_MS);
  return () => window.clearInterval(timer);
}

export function useIsOpen(hours: Hours): boolean | null {
  const { open, close } = hours;
  const getSnapshot = useCallback(
    () => isOpenAt(new Date(), { open, close }),
    [open, close],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
