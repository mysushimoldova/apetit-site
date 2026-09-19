// Доступность блюд по точкам (SPEC 2.1): галочка «есть / нет» и своя цена.
// Пока правила простые (решение архитектора): пицца выключена в обеих точках
// Сорок, супы выключены везде, остальное включено везде по базовой цене.
// На этапе админки таблица переедет в Supabase, форма записи останется.
import { POINTS } from "@/data/points";
import { PRODUCTS } from "./products";
import type { PointProduct } from "./schema";

function isEnabled(pointId: string, category: string): boolean {
  if (category === "supe") return false;
  if (category === "pizza" && pointId.startsWith("soroca")) return false;
  return true;
}

export const POINT_PRODUCTS: readonly PointProduct[] = POINTS.flatMap((point) =>
  PRODUCTS.map((product) => ({
    pointId: point.id,
    productSlug: product.slug,
    enabled: isEnabled(point.id, product.category),
    price: null,
  })),
);
