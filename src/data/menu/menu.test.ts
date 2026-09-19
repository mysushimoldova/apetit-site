import { describe, expect, it } from "vitest";
import { z } from "zod";
import images from "@/data/images.json";
import { POINTS } from "@/data/points";
import { ADDONS } from "./addons";
import { CATEGORIES } from "./categories";
import { getMenuForCity, getMenuForPoint, priceLabel } from "./index";
import { POINT_PRODUCTS } from "./point-products";
import { PRODUCTS } from "./products";
import {
  AddonSchema,
  CategorySchema,
  PointProductSchema,
  ProductSchema,
} from "./schema";

const bySlug = (slug: string) => {
  const p = PRODUCTS.find((x) => x.slug === slug);
  if (!p) throw new Error(`нет блюда ${slug}`);
  return p;
};

describe("схемы (zod) принимают все данные", () => {
  it("категории", () => {
    expect(() => z.array(CategorySchema).parse(CATEGORIES)).not.toThrow();
  });
  it("блюда", () => {
    expect(() => z.array(ProductSchema).parse(PRODUCTS)).not.toThrow();
  });
  it("добавки", () => {
    expect(() => z.array(AddonSchema).parse(ADDONS)).not.toThrow();
  });
  it("доступность по точкам", () => {
    expect(() =>
      z.array(PointProductSchema).parse(POINT_PRODUCTS),
    ).not.toThrow();
  });
});

describe("категории (SPEC §3 шаг 2)", () => {
  it("в порядке SPEC, супы — последними", () => {
    expect(CATEGORIES.map((c) => c.slug)).toEqual([
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
    ]);
  });
  it("у каждой категории есть рисованная иконка и оба названия", () => {
    for (const c of CATEGORIES) {
      expect(c.icon, c.slug).toBeTruthy();
      expect(c.name.ro.trim().length, c.slug).toBeGreaterThan(0);
      expect(c.name.ru.trim().length, c.slug).toBeGreaterThan(0);
    }
  });
});

describe("блюда (SPEC приложение А)", () => {
  it("57 блюд, slug уникальны и в формате имени файла", () => {
    expect(PRODUCTS).toHaveLength(57);
    const slugs = PRODUCTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  it("каждое блюдо ссылается на существующую категорию", () => {
    const cats = new Set(CATEGORIES.map((c) => c.slug));
    for (const p of PRODUCTS) expect(cats.has(p.category), p.slug).toBe(true);
  });

  it("цены > 0 у блюд, вариантов и добавок", () => {
    for (const p of PRODUCTS) {
      expect(p.price, p.slug).toBeGreaterThan(0);
      for (const v of p.variants ?? [])
        expect(v.price, `${p.slug}/${v.id}`).toBeGreaterThan(0);
    }
    for (const a of ADDONS) expect(a.price, a.id).toBeGreaterThan(0);
  });

  it("фото: либо null («без фото»), либо есть в images.json", () => {
    const known = new Set(Object.keys(images.products));
    for (const p of PRODUCTS) {
      if (p.photo !== null) expect(known.has(p.photo), p.slug).toBe(true);
    }
  });

  it("slug = имя файла фото, когда фото есть", () => {
    for (const p of PRODUCTS) if (p.photo) expect(p.photo, p.slug).toBe(p.slug);
  });

  it("без фото — только лимонады, чай и кофе (SPEC 2.7)", () => {
    expect(PRODUCTS.filter((p) => p.photo === null).map((p) => p.slug)).toEqual(
      [
        "limonada-aloe-fresh",
        "limonada-portocala",
        "ceai-craft",
        "espresso",
        "americano",
        "latte",
        "cappuccino",
      ],
    );
  });

  it("варианты размера ровно у четырёх блюд (SPEC 2.3)", () => {
    const withVariants = PRODUCTS.filter(
      (p) =>
        p.variants &&
        p.variants.length > 1 &&
        new Set(p.variants.map((v) => v.price)).size > 1,
    );
    expect(withVariants.map((p) => p.slug).sort()).toEqual(
      ["burger-menu", "cartofi-pai", "kebab-menu", "kebab-xl-xxl"].sort(),
    );
    expect(
      bySlug("kebab-xl-xxl").variants?.map((v) => [v.price, v.grams]),
    ).toEqual([
      [80, 340],
      [99, 430],
    ]);
    expect(
      bySlug("cartofi-pai").variants?.map((v) => [v.price, v.grams]),
    ).toEqual([
      [23, 120],
      [30, 180],
    ]);
    expect(bySlug("kebab-menu").variants?.map((v) => v.price)).toEqual([
      130, 170,
    ]);
    expect(bySlug("burger-menu").variants?.map((v) => v.price)).toEqual([
      130, 170,
    ]);
  });

  it("базовая цена = минимальная цена вариантов", () => {
    for (const p of PRODUCTS) {
      if (p.variants?.length)
        expect(p.price, p.slug).toBe(
          Math.min(...p.variants.map((v) => v.price)),
        );
    }
  });

  it("состав ro и ru одной длины, названия непустые", () => {
    for (const p of PRODUCTS) {
      expect(p.ingredients.ru.length, p.slug).toBe(p.ingredients.ro.length);
      expect(p.name.ro.trim().length, p.slug).toBeGreaterThan(0);
      expect(p.name.ru.trim().length, p.slug).toBeGreaterThan(0);
    }
  });

  it("убрать можно состав без основы; у комбо — ничего (это части набора)", () => {
    const removable = (slug: string) =>
      bySlug(slug)?.removable.map((r) => r.id);
    expect(removable("kebab-cheese")).toContain("rosii");
    expect(removable("kebab-cheese")).not.toContain("lipie");
    // База = хлеб + главный ингредиент из названия (ответ архитектора)
    expect(removable("kebab-cheese")).not.toContain("cascaval");
    expect(removable("kebab-crispy")).not.toContain("crispy");
    expect(removable("kebab-philly-beef")).not.toContain("vita");
    expect(removable("kebab-philly-beef")).toContain("cascaval");
    expect(removable("cheeseburger-pui")).not.toContain("carne-de-pui");
    expect(removable("cheeseburger-pui")).not.toContain("cascaval");
    expect(removable("cheeseburger-pui")).toContain("rosii");
    expect(removable("hamburger-vita")).not.toContain("vita-porc");
    expect(removable("gozleme-carne")).not.toContain("carne-de-pui");
    expect(removable("gozleme-carne")).toContain("mozzarella");
    expect(removable("gozleme-mozzarella")).not.toContain("mozzarella");
    expect(removable("hot-dog-classic")).not.toContain("crenvusca");
    expect(removable("hot-dog-classic")).toContain("varza");
    expect(removable("sandwich-salam")).not.toContain("salam");
    expect(removable("sandwich-sunca")).not.toContain("sunca");
    expect(removable("pizza-pepperoni")).not.toContain("salam-crud-afumat");
    expect(removable("kebab-menu")).toEqual([]);
    expect(removable("burger-menu")).toEqual([]);
    for (const p of PRODUCTS) {
      const ids = p.removable.map((r) => r.id);
      expect(new Set(ids).size, p.slug).toBe(ids.length);
    }
  });

  it("контрольные цены из SPEC", () => {
    expect(bySlug("kebab-cheese")).toMatchObject({ price: 105, grams: 440 });
    expect(bySlug("cheeseburger-dublu-pui")).toMatchObject({
      price: 115,
      grams: 385,
    });
    expect(bySlug("pizza-4-carnuri")).toMatchObject({ price: 155, grams: 560 });
    expect(bySlug("le-coq-mojito")).toMatchObject({ price: 36 });
    expect(bySlug("brinzoaice")).toMatchObject({ price: 50, grams: 120 });
  });
});

describe("добавки (SPEC 2.4)", () => {
  it("18 штук, id уникальны", () => {
    expect(ADDONS).toHaveLength(18);
    expect(new Set(ADDONS.map((a) => a.id)).size).toBe(18);
  });
  it("контрольные цены", () => {
    const price = (id: string) => ADDONS.find((a) => a.id === id)?.price;
    expect(price("carne")).toBe(15);
    expect(price("castraveti-felii")).toBe(2);
    expect(price("sosiera-ketchup")).toBe(8);
    expect(price("sosiera-maioneza")).toBe(10);
  });
});

describe("доступность по точкам", () => {
  const pointIds = POINTS.map((p) => p.id);
  it("запись на каждую пару точка × блюдо", () => {
    expect(POINT_PRODUCTS).toHaveLength(pointIds.length * PRODUCTS.length);
  });
  it("пицца выключена в обеих точках Сорок и включена в остальных", () => {
    for (const pp of POINT_PRODUCTS) {
      if (bySlug(pp.productSlug).category !== "pizza") continue;
      const soroca = pp.pointId.startsWith("soroca");
      expect(pp.enabled, `${pp.pointId}/${pp.productSlug}`).toBe(!soroca);
    }
  });
  it("супы выключены везде, остальное включено по базовой цене", () => {
    for (const pp of POINT_PRODUCTS) {
      const cat = bySlug(pp.productSlug).category;
      if (cat === "supe") expect(pp.enabled, pp.productSlug).toBe(false);
      else if (cat !== "pizza") expect(pp.enabled, pp.productSlug).toBe(true);
      expect(pp.price).toBeNull();
    }
  });
  it("getMenuForCity: Soroca — 11 категорий без пиццы, Briceni — 12", () => {
    const soroca = getMenuForCity("soroca").map((s) => s.category.slug);
    expect(soroca).toHaveLength(11);
    expect(soroca).not.toContain("pizza");
    expect(soroca).not.toContain("supe");
    const briceni = getMenuForCity("briceni").map((s) => s.category.slug);
    expect(briceni).toHaveLength(12);
    expect(briceni).toContain("pizza");
  });
  it("getMenuForPoint отдаёт цену точки", () => {
    const menu = getMenuForPoint("briceni");
    const kebab = menu
      .find((s) => s.category.slug === "kebab")
      ?.products.find((p) => p.slug === "kebab-cheese");
    expect(kebab?.price).toBe(105);
  });
});

describe("подпись цены", () => {
  it("«de la» только при вариантах с разной ценой", () => {
    expect(priceLabel(bySlug("kebab-xl-xxl"))).toEqual({
      from: true,
      price: 80,
    });
    expect(priceLabel(bySlug("kebab-cheese"))).toEqual({
      from: false,
      price: 105,
    });
    expect(priceLabel(bySlug("sos-apetit"))).toEqual({
      from: false,
      price: 15,
    });
  });
});
