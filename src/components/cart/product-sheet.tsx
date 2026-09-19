"use client";
// Лист блюда (SPEC §3 шаг 3, DESIGN.md → Product Sheet): фото 280px, название
// Oswald 22px, состав, граммы; блоки Mărime (сегменты), Fără (галочки,
// бесплатно), Extra (добавки категории с ценой); внизу ± и «Adaugă · N lei».
// Цена пересчитывается на лету той же функцией, что потом проверит сервер.
import { Check } from "lucide-react";
import { useId, useState } from "react";
import { FoodPicture } from "@/components/menu/food-picture";
import { Sheet } from "@/components/sheet/sheet";
import { formatPrice } from "@/i18n/messages";
import type { LineConfig } from "@/lib/cart/lines";
import { priceLine, type CatalogProduct } from "@/lib/cart/pricing";
import { cartStore } from "@/lib/cart/store";
import { useCartContext } from "./cart-context";
import { QuantityStepper } from "./quantity-stepper";

const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

export function ProductSheet({
  product,
  open,
  onDismiss,
  onClosed,
}: {
  product: CatalogProduct;
  open: boolean;
  onDismiss: () => void;
  onClosed: () => void;
}) {
  const { city, locale, t, catalog } = useCartContext();
  // По умолчанию — первый (самый дешёвый) размер
  const [variantId, setVariantId] = useState(product.variants?.[0]?.id ?? null);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const ids = useId();
  const titleId = `${ids}-title`;

  const config: LineConfig = {
    productSlug: product.slug,
    variantId,
    addonIds,
    removedIds,
  };
  const total = priceLine({ ...config, qty }, catalog)?.total ?? null;

  const name = product.name[locale];
  const variant = product.variants?.find((v) => v.id === variantId) ?? null;
  // У комбо свой состав у каждого размера
  const ingredients = (variant?.ingredients ?? product.ingredients)[locale];
  const grams = variant?.grams ?? product.grams;
  const addons = product.addonIds
    .map((id) => catalog.addons[id])
    .filter((a) => a !== undefined);

  function addToCart() {
    if (cartStore.getState().add(city, config, qty)) onDismiss();
  }

  const footer = (
    <div className="flex items-center gap-3">
      <QuantityStepper value={qty} onChange={setQty} t={t} />
      <button
        type="button"
        className="btn-primary min-w-0 flex-1"
        onClick={addToCart}
        disabled={total === null}
      >
        {t.sheet.add} · {total === null ? "" : formatPrice(locale, t, total)}
      </button>
    </div>
  );

  return (
    <Sheet
      open={open}
      onDismiss={onDismiss}
      onClosed={onClosed}
      labelledBy={titleId}
      closeLabel={t.a11y.close}
      footer={footer}
    >
      <FoodPicture photo={product.photo} alt={name} size="sheet" eager />
      <h2
        id={titleId}
        className="mt-6 font-display text-sheet-title text-balance uppercase"
      >
        {name}
      </h2>
      {ingredients.length > 0 && (
        <p className="mt-3 font-body text-meta text-charcoal">
          {ingredients.join(", ")}
        </p>
      )}
      {grams && (
        <p className="mt-1 font-body text-meta text-smoke tabular-nums">
          {grams} {t.menu.grams}
        </p>
      )}

      <div className="mt-5">
        {product.variants && (
          <div className="sheet-block">
            <h3 id={`${ids}-size`} className="caption-caps">
              {t.sheet.size}
            </h3>
            <div
              role="radiogroup"
              aria-labelledby={`${ids}-size`}
              className="mt-3 flex flex-wrap gap-2"
            >
              {product.variants.map((v) => (
                <label key={v.id} className="segment">
                  <input
                    type="radio"
                    name={`${ids}-size`}
                    value={v.id}
                    checked={variantId === v.id}
                    onChange={() => setVariantId(v.id)}
                    className="sr-only"
                  />
                  {v.name[locale]}
                </label>
              ))}
            </div>
          </div>
        )}

        {product.removable.length > 0 && (
          <div
            role="group"
            aria-labelledby={`${ids}-without`}
            className="sheet-block"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 id={`${ids}-without`} className="caption-caps">
                {t.sheet.without}
              </h3>
              <span className="font-body text-meta text-smoke">
                {t.sheet.free}
              </span>
            </div>
            <div className="mt-1">
              {product.removable.map((r) => (
                <label key={r.id} className="check-row" data-kind="without">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={removedIds.includes(r.id)}
                    onChange={() => setRemovedIds((l) => toggle(l, r.id))}
                  />
                  <span className="check-box" aria-hidden="true">
                    <Check size={14} strokeWidth={2.5} />
                  </span>
                  <span className="check-label first-letter:uppercase">
                    {r.name[locale]}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {addons.length > 0 && (
          <div
            role="group"
            aria-labelledby={`${ids}-extra`}
            className="sheet-block"
          >
            <h3 id={`${ids}-extra`} className="caption-caps">
              {t.sheet.extra}
            </h3>
            <div className="mt-1">
              {addons.map((a) => (
                <label key={a.id} className="check-row">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={addonIds.includes(a.id)}
                    onChange={() => setAddonIds((l) => toggle(l, a.id))}
                  />
                  <span className="check-box" aria-hidden="true">
                    <Check size={14} strokeWidth={2.5} />
                  </span>
                  <span className="check-label min-w-0 flex-1">
                    {a.name[locale]}
                  </span>
                  <span className="flex-none font-ui text-label font-semibold tabular-nums">
                    +{formatPrice(locale, t, a.price)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
