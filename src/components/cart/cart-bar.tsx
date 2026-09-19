"use client";
// Cart Bar (DESIGN.md → Cart Bar): fixed снизу, стекло, сверху линия, 72px.
// Слева корзина с бейджем (штуки), в центре «N poziții», справа Primary
// «Coș · N lei». Весь бар — одна кнопка: открывает лист корзины.
// Выезжает снизу, когда в корзине ≥ 1 позиции. Только телефон
// (на десктопе — HeaderCartButton в шапке).
import { ShoppingBasket } from "lucide-react";
import { useRef, useState } from "react";
import { formatPrice, plural } from "@/i18n/messages";
import { useBump, useCartContext, useCartSummary } from "./cart-context";

export function CartBar() {
  const { t, locale, openCart } = useCartContext();
  const { positions, pieces, total } = useCartSummary();
  const visible = positions > 0;

  // Пока бар уезжает (корзину очистили), показываем последние цифры, а не «0»
  const [shown, setShown] = useState({ positions, pieces, total });
  if (
    visible &&
    (shown.positions !== positions ||
      shown.pieces !== pieces ||
      shown.total !== total)
  ) {
    setShown({ positions, pieces, total });
  }
  const view = visible ? { positions, pieces, total } : shown;

  const iconRef = useRef<HTMLSpanElement>(null);
  useBump(iconRef);

  return (
    <div
      className="cart-bar glass"
      data-visible={visible || undefined}
      inert={!visible}
    >
      <button type="button" className="cart-bar-button" onClick={openCart}>
        <span ref={iconRef} className="relative flex-none">
          <ShoppingBasket size={24} strokeWidth={1.75} aria-hidden="true" />
          <span className="cart-badge" aria-hidden="true">
            {view.pieces}
          </span>
        </span>
        <span className="min-w-0 flex-1 truncate font-body text-body tabular-nums">
          {plural(locale, t.cart.positions, view.positions)}
        </span>
        {/* Primary внутри бара — 48px: бар 72px с отступами 12px */}
        <span className="btn-primary h-12! px-5!">
          {t.cart.title} · {formatPrice(locale, t, view.total)}
        </span>
      </button>
    </div>
  );
}
