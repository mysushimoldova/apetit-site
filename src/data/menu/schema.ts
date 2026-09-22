// Схемы данных меню (zod) — единственный источник типов.
// SPEC §2.2 (структура блюда), §2.3 (варианты), §2.4 (добавки), §2.1 (точки).
import { z } from "@/lib/zod";

// Текст на двух языках вынесен в ./localized и написан на лёгком zod/mini:
// он лежит внутри снимка заказа, а тот нужен в браузере. Здесь — обычный
// re-export, схемы mini и полного zod вкладываются друг в друга как есть.
export {
  LocalizedSchema,
  LocalizedListSchema,
  type Localized,
  type LocalizedList,
} from "./localized";
import { LocalizedSchema, LocalizedListSchema } from "./localized";

/** Slug — латиница, цифры, дефис; у блюда совпадает с именем файла фото. */
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
/** Цена в леях, целое, > 0. Считается только на сервере (CLAUDE.md). */
const price = z.number().int().positive();
const grams = z.number().int().positive();

export const CATEGORY_SLUGS = [
  "kebab",
  "menu",
  "burgers",
  "gozleme",
  "crispy",
  "hot-dog",
  "sandwich",
  "salad",
  "pizza",
  "sosuri",
  "drinks",
  "desert",
  "supe",
] as const;
export const CategorySlugSchema = z.enum(CATEGORY_SLUGS);
export type CategorySlug = z.infer<typeof CategorySlugSchema>;

/** Какие виды добавок принимают блюда категории (SPEC 2.4, предположение). */
export const AddonKindSchema = z.enum(["ingredient", "sauce-cup"]);

export const CategorySchema = z.object({
  slug: CategorySlugSchema,
  name: LocalizedSchema,
  /** Имя рисованной иконки (src/components/icons) */
  icon: z.string().min(1),
  addonKinds: z.array(AddonKindSchema),
});
export type Category = z.infer<typeof CategorySchema>;

/** Вариант размера с своей ценой (SPEC 2.3): XL / XXL, mic / mare, dulce / picant. */
export const VariantSchema = z.object({
  id: slug,
  name: LocalizedSchema,
  price,
  grams: grams.nullable(),
  /** Состав варианта, если отличается (комбо-меню).
   *  LocalizedListSchema — схема zod/mini, у неё нет метода .nullable(). */
  ingredients: z.nullable(LocalizedListSchema),
});
export type Variant = z.infer<typeof VariantSchema>;

/** Ингредиент, который можно убрать бесплатно (SPEC §3 шаг 3). */
export const RemovableSchema = z.object({
  id: slug,
  name: LocalizedSchema,
});
export type Removable = z.infer<typeof RemovableSchema>;

export const ProductSchema = z.object({
  slug,
  category: CategorySlugSchema,
  name: LocalizedSchema,
  /** Короткое название для плитки меню: полное не влезает в две строки на
   *  телефоне (решение архитектора 22.09.2026). null — плитка показывает
   *  name. В листе блюда, корзине и заказе всегда полное название. */
  tileName: z.nullable(LocalizedSchema),
  ingredients: LocalizedListSchema,
  grams: grams.nullable(),
  /** Базовая цена (Briceni). При вариантах — минимальная из них. */
  price,
  variants: z.array(VariantSchema).min(2).nullable(),
  removable: z.array(RemovableSchema),
  /** Slug фото в images.json; null — карточка без фото (SPEC 2.2). */
  photo: slug.nullable(),
  /** Общий выключатель (SPEC 2.2 «Активно»). */
  active: z.boolean(),
});
export type Product = z.infer<typeof ProductSchema>;

export const AddonSchema = z.object({
  id: slug,
  name: LocalizedSchema,
  price,
  kind: AddonKindSchema,
});
export type Addon = z.infer<typeof AddonSchema>;

/** Блюдо в точке: включено ли и своя цена (null — базовая). SPEC 2.1. */
export const PointProductSchema = z.object({
  pointId: slug,
  productSlug: slug,
  enabled: z.boolean(),
  price: price.nullable(),
});
export type PointProduct = z.infer<typeof PointProductSchema>;
