"use client";
// Лист корзины (SPEC §3 шаг 4): позиции с размером/добавками/«без»,
// количество ±, «Șterge», «Golește coșul», итог, «Comandă» → оформление.
// Вне рабочих часов — Closed Banner сверху и «Comandă» неактивна (только
// показ: решает сервер).
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { FoodPicture } from "@/components/menu/food-picture";
import { ClosedBanner } from "@/components/order/closed-banner";
import { Sheet } from "@/components/sheet/sheet";
import { formatPrice } from "@/i18n/messages";
import { describeParts, lineParts } from "@/lib/cart/describe";
import { lineKey, type CartLine } from "@/lib/cart/lines";
import { priceLine } from "@/lib/cart/pricing";
import { cartStore } from "@/lib/cart/store";
import { useIsOpen } from "@/lib/order/use-is-open";
import { useCartContext, useCartSummary } from "./cart-context";
import { ClearCartButton } from "./clear-cart-button";
import { QuantityStepper } from "./quantity-stepper";

export function CartSheet({
  open,
  onDismiss,
}: {
  open: boolean;
  onDismiss: () => void;
}) {
  const { t, locale, city, hours } = useCartContext();
  const summary = useCartSummary();
  const closed = useIsOpen(hours) === false;
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Пока лист уезжает (удалили последнюю позицию), показываем прежний список
  const [shown, setShown] = useState(summary);
  if (open && shown !== summary) setShown(summary);
  const { lines, total } = open ? summary : shown;

  const footer = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-ui text-label font-semibold">{t.cart.total}</span>
        <span className="font-ui text-total tabular-nums">
          {formatPrice(locale, t, total)}
        </span>
      </div>
      {closed ? (
        <button type="button" className="btn-primary mt-3 w-full" disabled>
          {t.cart.order}
        </button>
      ) : (
        <Link href={`/${city}/comanda`} className="btn-primary mt-3 w-full">
          {t.cart.order}
        </Link>
      )}
    </>
  );

  return (
    <Sheet
      open={open}
      onDismiss={onDismiss}
      labelledBy={titleId}
      closeLabel={t.a11y.close}
      footer={footer}
    >
      <h2
        id={titleId}
        ref={titleRef}
        tabIndex={-1}
        className="font-display text-sheet-title uppercase outline-none"
      >
        {t.cart.title}
      </h2>
      {closed && (
        <div className="mt-3">
          <ClosedBanner hours={hours} t={t} />
        </div>
      )}
      <ul className="mt-2">
        {lines.map((line) => (
          <CartLineRow
            key={lineKey(line)}
            line={line}
            // Кнопка удалена вместе со строкой — фокус на заголовок листа
            onRemoved={() => titleRef.current?.focus()}
          />
        ))}
      </ul>
      <div className="mt-2">
        <ClearCartButton />
      </div>
    </Sheet>
  );
}

function CartLineRow({
  line,
  onRemoved,
}: {
  line: CartLine;
  onRemoved: () => void;
}) {
  const { t, locale, catalog } = useCartContext();
  const product = catalog.products[line.productSlug];
  const price = priceLine(line, catalog);
  if (!product || !price) return null;

  const key = lineKey(line);
  const name = product.name[locale];
  const parts = lineParts(line, catalog);
  const details = parts ? describeParts(parts, locale, t) : "";

  return (
    <li className="cart-line flex gap-3 py-4">
      <div className="w-16 flex-none">
        {/* eager: лист открыт — миниатюра нужна сразу, а не «при прокрутке» */}
        <FoodPicture photo={product.photo} alt="" size="thumb" eager />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 font-ui text-title">{name}</p>
          <span className="price-pill-lg flex-none">
            {formatPrice(locale, t, price.total)}
          </span>
        </div>
        {details && (
          <p className="mt-1 font-body text-meta text-charcoal">{details}</p>
        )}
        <div className="mt-3 flex items-center justify-between gap-3">
          <QuantityStepper
            size="sm"
            value={line.qty}
            onChange={(qty) => cartStore.getState().setQty(key, qty)}
            label={`${t.a11y.quantity}: ${name}`}
            t={t}
          />
          <button
            type="button"
            className="inline-flex h-11 touch-manipulation items-center rounded-pill px-3 font-ui text-label font-semibold underline underline-offset-4 [-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [@media(hover:hover)_and_(pointer:fine)]:hover:bg-sand"
            aria-label={`${t.cart.remove}: ${name}`}
            onClick={() => {
              cartStore.getState().remove(key);
              onRemoved();
            }}
          >
            {t.cart.remove}
          </button>
        </div>
      </div>
    </li>
  );
}
