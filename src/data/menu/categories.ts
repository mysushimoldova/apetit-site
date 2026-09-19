// Категории меню в порядке SPEC §3 шаг 2 (+ Supe последней: супы пока
// выключены везде, поэтому категория нигде не показывается).
// TODO ru: проверить — русские названия черновые.
import type { Category } from "./schema";

const INGREDIENT_AND_SAUCE = ["ingredient", "sauce-cup"] as const;
const SAUCE_ONLY = ["sauce-cup"] as const;
const NONE = [] as const;

export const CATEGORIES: readonly Category[] = [
  {
    slug: "kebab",
    name: { ro: "Kebab", ru: "Кебаб" },
    icon: "kebab",
    addonKinds: [...INGREDIENT_AND_SAUCE],
  },
  {
    slug: "menu",
    name: { ro: "Menu", ru: "Комбо" },
    icon: "menu",
    addonKinds: [...SAUCE_ONLY],
  },
  {
    slug: "burgers",
    name: { ro: "Burgers", ru: "Бургеры" },
    icon: "burger",
    addonKinds: [...INGREDIENT_AND_SAUCE],
  },
  {
    slug: "gozleme",
    name: { ro: "Gözleme", ru: "Гёзлеме" },
    icon: "gozleme",
    addonKinds: [...INGREDIENT_AND_SAUCE],
  },
  {
    slug: "crispy",
    name: { ro: "Crispy", ru: "Криспи" },
    icon: "crispy",
    addonKinds: [...SAUCE_ONLY],
  },
  {
    slug: "hot-dog",
    name: { ro: "Hot Dog", ru: "Хот-дог" },
    icon: "hot-dog",
    addonKinds: [...INGREDIENT_AND_SAUCE],
  },
  {
    slug: "sandwich",
    name: { ro: "Sandwich", ru: "Сэндвич" },
    icon: "sandwich",
    addonKinds: [...INGREDIENT_AND_SAUCE],
  },
  {
    slug: "salad",
    name: { ro: "Salad", ru: "Салаты" },
    icon: "salad",
    addonKinds: [...SAUCE_ONLY],
  },
  {
    slug: "pizza",
    name: { ro: "Pizza", ru: "Пицца" },
    icon: "pizza",
    addonKinds: [...SAUCE_ONLY],
  },
  {
    slug: "sosuri",
    name: { ro: "Sosuri", ru: "Соусы" },
    icon: "sos",
    addonKinds: [...NONE],
  },
  {
    slug: "drinks",
    name: { ro: "Drinks", ru: "Напитки" },
    icon: "drinks",
    addonKinds: [...NONE],
  },
  {
    slug: "desert",
    name: { ro: "Desert", ru: "Десерт" },
    icon: "desert",
    addonKinds: [...NONE],
  },
  {
    slug: "supe",
    name: { ro: "Supe", ru: "Супы" },
    icon: "plate",
    addonKinds: [...NONE],
  },
];

export function getCategory(slug: Category["slug"]): Category {
  const category = CATEGORIES.find((c) => c.slug === slug);
  if (!category) throw new Error(`Unknown category: ${slug}`);
  return category;
}
