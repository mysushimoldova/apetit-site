"use client";
// Лист корзины (SPEC §3 шаг 4): позиции с размером/добавками/«без»,
// количество ±, «Șterge», итог. «Comandă» пока неактивна — оформление
// заказа следующей задачей.
import { useId, useRef, useState } from "react";
import { FoodPicture } from "@/components/menu/food-picture";
import { Sheet } from "@/components/sheet/sheet";
import type { Locale } from "@/data/points";
import { formatPrice, type Messages } from "@/i18n/messages";
import { lineKey, type CartLine } from "@/lib/cart/lines";
import {
  priceLine,
  type Catalog,
  type CatalogProduct,
} from "@/lib/cart/pricing";
import { cartStore } from "@/lib/cart/store";
import { useCartContext, useCartSummary } from "./cart-context";
import { QuantityStepper } from "./quantity-stepper";

/** «XXL · Extra: Sos de usturoi · Fără: roșii» */
function describeLine(
  line: CartLine,
  product: CatalogProduct,
  catalog: Catalog,
  locale: Locale,
  t: Messages,
): string {
  const parts: string[] = [];
  const variant = product.variants?.find((v) => v.id === line.variantId);
  if (variant) parts.push(variant.name[locale]);
  const addons = line.addonIds
    .map((id) => catalog.addons[id]?.name[locale])
    .filter(Boolean);
  if (addons.length) parts.push(`${t.sheet.extra}: ${addons.join(", ")}`);
  const removed = line.removedIds
    .map((id) => product.removable.find((r) => r.id === id)?.name[locale])
    .filter(Boolean);
  if (removed.length) parts.push(`${t.sheet.without}: ${removed.join(", ")}`);
  return parts.join(" · ");
}

export function CartSheet({
  open,
  onDismiss,
}: {
  open: boolean;
  onDismiss: () => void;
}) {
  const { t, locale } = useCartContext();
  const summary = useCartSummary();
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
      {/* Оформление заказа — следующая задача */}
      <button type="button" className="btn-primary mt-3 w-full" disabled>
        {t.cart.order}
      </button>
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
  const details = describeLine(line, product, catalog, locale, t);

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
