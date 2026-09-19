// Сборка меню для точки / города: категории в порядке SPEC с включёнными
// блюдами по ценам точки. Категория без включённых блюд не показывается.
import { POINTS, type CitySlug } from "@/data/points";
import { ADDONS } from "./addons";
import { CATEGORIES } from "./categories";
import { POINT_PRODUCTS } from "./point-products";
import { PRODUCTS } from "./products";
import type { Addon, Category, Product } from "./schema";

export * from "./schema";
export { ADDONS } from "./addons";
export { CATEGORIES, getCategory } from "./categories";
export { POINT_PRODUCTS } from "./point-products";
export { PRODUCTS, getProduct } from "./products";

/** Блюдо с ценой конкретной точки. */
export type MenuProduct = Product;

export interface MenuSection {
  category: Category;
  products: MenuProduct[];
}

export function productPrice(product: Product, pointId: string): number {
  const pp = POINT_PRODUCTS.find(
    (x) => x.pointId === pointId && x.productSlug === product.slug,
  );
  return pp?.price ?? product.price;
}

export function getMenuForPoint(pointId: string): MenuSection[] {
  const enabled = new Set(
    POINT_PRODUCTS.filter((x) => x.pointId === pointId && x.enabled).map(
      (x) => x.productSlug,
    ),
  );
  return CATEGORIES.map((category) => ({
    category,
    products: PRODUCTS.filter(
      (p) => p.category === category.slug && p.active && enabled.has(p.slug),
    ).map((p) => ({ ...p, price: productPrice(p, pointId) })),
  })).filter((section) => section.products.length > 0);
}

/** Меню города — по первой точке города (выбор точки будет в корзине). */
export function getMenuForCity(citySlug: CitySlug): MenuSection[] {
  const point = POINTS.find((p) => p.citySlug === citySlug);
  if (!point) throw new Error(`No points for city ${citySlug}`);
  return getMenuForPoint(point.id);
}

/** «de la 80 lei», если у вариантов разные цены; иначе просто цена. */
export function priceLabel(product: Product): { from: boolean; price: number } {
  const prices = product.variants?.map((v) => v.price) ?? [];
  const from = prices.length > 1 && new Set(prices).size > 1;
  return { from, price: from ? Math.min(...prices) : product.price };
}

/** Какие добавки разрешены блюду — по видам добавок его категории. */
export function addonsFor(product: Product): Addon[] {
  const kinds =
    CATEGORIES.find((c) => c.slug === product.category)?.addonKinds ?? [];
  return ADDONS.filter((a) => kinds.includes(a.kind));
}
