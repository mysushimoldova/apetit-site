// Цена позиции корзины по id (SPEC §9.3). На клиенте — только для показа;
// сервер заказа вызовет эту же функцию со своим каталогом точки и посчитает
// всё заново. Любая несостыковка (нет блюда, размера, добавка не разрешена)
// → null: такую позицию нельзя ни показать, ни заказать.
import type {
  Addon,
  CategorySlug,
  Localized,
  LocalizedList,
  Removable,
  Variant,
} from "@/data/menu/schema";
import { CartLineSchema, type CartLine } from "./lines";

/** Размеры готовых WebP (images.json) — чтобы лист рисовал фото без JSON в бандле. */
export interface PhotoInfo {
  slug: string;
  width: number;
  height: number;
  sizes: number[];
}

/** Блюдо так, как его продаёт точка: цена точки + разрешённые добавки. */
export interface CatalogProduct {
  slug: string;
  category: CategorySlug;
  name: Localized;
  ingredients: LocalizedList;
  grams: number | null;
  /** Цена точки (для блюда с размерами — цена у каждого размера). */
  price: number;
  variants: Variant[] | null;
  removable: Removable[];
  /** Разрешённые добавки, в порядке показа. */
  addonIds: string[];
  photo: PhotoInfo | null;
}

export interface Catalog {
  products: Record<string, CatalogProduct>;
  addons: Record<string, Addon>;
}

export interface LinePrice {
  /** Цена одной штуки: размер (или блюдо) + добавки. */
  unit: number;
  /** unit × количество. */
  total: number;
}

export function priceLine(line: CartLine, catalog: Catalog): LinePrice | null {
  if (!CartLineSchema.safeParse(line).success) return null;
  const product = catalog.products[line.productSlug];
  if (!product) return null;

  let base: number;
  if (product.variants) {
    const variant = product.variants.find((v) => v.id === line.variantId);
    if (!variant) return null;
    base = variant.price;
  } else {
    if (line.variantId !== null) return null;
    base = product.price;
  }

  if (new Set(line.addonIds).size !== line.addonIds.length) return null;
  const allowed = new Set(product.addonIds);
  let extras = 0;
  for (const addonId of line.addonIds) {
    const addon = catalog.addons[addonId];
    if (!addon || !allowed.has(addonId)) return null;
    extras += addon.price;
  }

  const removable = new Set(product.removable.map((r) => r.id));
  if (!line.removedIds.every((r) => removable.has(r))) return null;

  const unit = base + extras;
  return { unit, total: unit * line.qty };
}

export function cartTotal(
  lines: readonly CartLine[],
  catalog: Catalog,
): number {
  return lines.reduce(
    (sum, line) => sum + (priceLine(line, catalog)?.total ?? 0),
    0,
  );
}

/** Оставить только позиции, которые точка может продать. */
export function pruneLines(
  lines: readonly CartLine[],
  catalog: Catalog,
): CartLine[] {
  return lines.filter((line) => priceLine(line, catalog) !== null);
}
