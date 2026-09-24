"use client";
// Общее для островков корзины: город, язык, тексты, каталог города и две
// команды — открыть лист блюда и лист корзины. Значения стабильны; сами
// позиции живут в сторе (useCart) — там подписка точечная.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import type { CitySlug, Locale } from "@/data/points";
import type { Messages } from "@/i18n/messages";
import type { Hours } from "@/lib/order/hours";
import type { CartLine } from "@/lib/cart/lines";
import { cartTotal, type Catalog } from "@/lib/cart/pricing";
import { useCart } from "@/lib/cart/store";

export interface CartContextValue {
  city: CitySlug;
  locale: Locale;
  t: Messages;
  catalog: Catalog;
  /** Часы приёма заказов (баннер «закрыто» в корзине) */
  hours: Hours;
  openProduct: (slug: string) => void;
  openCart: () => void;
}

export const CartContext = createContext<CartContextValue | null>(null);

export function useCartContext(): CartContextValue {
  const value = useContext(CartContext);
  if (!value)
    throw new Error("useCartContext: нет CartProvider выше по дереву");
  return value;
}

const NO_LINES: CartLine[] = [];

export interface CartSummary {
  lines: CartLine[];
  /** Число позиций («1 poziție») */
  positions: number;
  /** Число штук (бейдж на значке) */
  pieces: number;
  /** Сумма для показа; настоящую посчитает сервер */
  total: number;
}

/** Сводка корзины города (корзина другого города — как пустая). */
export function useCitySummary(city: CitySlug, catalog: Catalog): CartSummary {
  const lines = useCart((s) =>
    s.hydrated && s.city === city ? s.lines : NO_LINES,
  );
  return useMemo(
    () => ({
      lines,
      positions: lines.length,
      pieces: lines.reduce((n, l) => n + l.qty, 0),
      total: cartTotal(lines, catalog),
    }),
    [lines, catalog],
  );
}

export function useCartSummary(): CartSummary {
  const { city, catalog } = useCartContext();
  return useCitySummary(city, catalog);
}

/**
 * Значок корзины один раз подпрыгивает после каждого добавления
 * (DESIGN.md → Add Button). WAAPI — идёт вне главного потока.
 * При «уменьшить движение» — не прыгает.
 */
export function useBump(ref: RefObject<HTMLElement | null>) {
  const bump = useCart((s) => s.bump);
  const seen = useRef(bump);
  useEffect(() => {
    if (bump === seen.current) return;
    seen.current = bump;
    const el = ref.current;
    if (!el?.animate) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Быстрые нажатия «+» подряд: не перезапускать прыжок с нуля (дёргается)
    if (el.getAnimations().some((a) => a.playState === "running")) return;
    el.animate(
      [
        { transform: "translateY(0)" },
        { transform: "translateY(-6px)", offset: 0.4 },
        { transform: "translateY(0)" },
      ],
      // --dur-state, --ease-out (docs/MOTION.md §2–3)
      { duration: 200, easing: "cubic-bezier(0.32, 0.72, 0, 1)" },
    );
  }, [bump, ref]);
}
