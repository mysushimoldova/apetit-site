"use client";
// Десктоп (≥1024px): корзина — кнопка в шапке, а не бар снизу
// (DESIGN.md → Layout). Появляется, когда в корзине ≥ 1 позиции.
// 40px: кнопка 52px в шапку 56px не помещается.
import { ShoppingBasket } from "lucide-react";
import { useRef } from "react";
import { formatPrice } from "@/i18n/messages";
import { useBump, useCartContext, useCartSummary } from "./cart-context";

export function HeaderCartButton() {
  const { t, locale, openCart } = useCartContext();
  const { positions, pieces, total } = useCartSummary();
  const iconRef = useRef<HTMLSpanElement>(null);
  useBump(iconRef);

  if (positions === 0) return null;
  return (
    <span className="header-cart hidden lg:block">
      <button
        type="button"
        onClick={openCart}
        className="btn-primary h-10! gap-3! px-4!"
      >
        <span ref={iconRef} className="relative">
          <ShoppingBasket size={20} strokeWidth={1.75} aria-hidden="true" />
          <span className="cart-badge" aria-hidden="true">
            {pieces}
          </span>
        </span>
        {t.cart.title} · {formatPrice(locale, t, total)}
      </button>
    </span>
  );
}
