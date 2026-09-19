"use client";
// Кнопка «+» на плитке (DESIGN.md → Add Button). Без размеров: добавляет 1 шт.
// как есть, без листа; после добавления — Ink-пилюля «− N +» (число — все
// штуки блюда в корзине). С размерами: всегда открывает лист, после
// добавления — Ink-круг с числом. Кнопка «+» остаётся тем же элементом при
// любом числе — фокус с клавиатуры не теряется.
import { Minus, Plus } from "lucide-react";
import { useRef } from "react";
import { useCartContext } from "@/components/cart/cart-context";
import { countOf } from "@/lib/cart/lines";
import { cartStore, useCart } from "@/lib/cart/store";

export function TileCartControl({
  slug,
  name,
  hasVariants,
}: {
  slug: string;
  name: string;
  hasVariants: boolean;
}) {
  const { city, t, openProduct } = useCartContext();
  const count = useCart((s) =>
    s.hydrated && s.city === city ? countOf(s.lines, slug) : 0,
  );
  const plusRef = useRef<HTMLButtonElement>(null);
  const active = count > 0;
  const stepper = active && !hasVariants;

  function add() {
    if (hasVariants) {
      openProduct(slug);
      return;
    }
    cartStore.getState().add(city, {
      productSlug: slug,
      variantId: null,
      addonIds: [],
      removedIds: [],
    });
  }

  function remove() {
    // Последняя штука: «−» исчезнет — фокус на «+», чтобы не улетел в начало
    if (count === 1) plusRef.current?.focus();
    cartStore.getState().decrementProduct(slug);
  }

  return (
    <div className="tile-cart ml-auto" data-active={active || undefined}>
      {stepper && (
        <button
          type="button"
          className="tile-cart-minus tile-cart-extra"
          aria-label={`${t.a11y.decrease}: ${name}`}
          onClick={remove}
        >
          <Minus size={16} strokeWidth={2.25} aria-hidden="true" />
        </button>
      )}
      {stepper && (
        <span className="tile-cart-count tile-cart-extra" aria-hidden="true">
          {count}
        </span>
      )}
      <button
        ref={plusRef}
        type="button"
        className="add-button"
        data-count={active && hasVariants ? "" : undefined}
        aria-label={
          active && hasVariants
            ? `${t.product.add}: ${name} (${count})`
            : `${t.product.add}: ${name}`
        }
        onClick={add}
      >
        {active && hasVariants ? (
          <span aria-hidden="true">{count}</span>
        ) : (
          <Plus size={18} strokeWidth={2.25} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
