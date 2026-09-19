import { describe, expect, it } from "vitest";
import { buildCatalog } from "./catalog";
import type { CartLine } from "./lines";
import { cartTotal, priceLine, pruneLines } from "./pricing";

const soroca = buildCatalog("soroca");
const briceni = buildCatalog("briceni");

const line = (over: Partial<CartLine>): CartLine => ({
  productSlug: "kebab-cheese",
  variantId: null,
  addonIds: [],
  removedIds: [],
  qty: 1,
  ...over,
});

describe("priceLine — цена позиции по id (вариант + добавки) × количество", () => {
  it("пример из задачи: Kebab XL/XXL, XXL + sos de usturoi, 2 шт. = 228 lei", () => {
    const price = priceLine(
      line({
        productSlug: "kebab-xl-xxl",
        variantId: "xxl",
        addonIds: ["sos-usturoi"],
        qty: 2,
      }),
      soroca,
    );
    // (99 + 15) × 2
    expect(price).toEqual({ unit: 114, total: 228 });
  });

  it("блюдо без вариантов — цена точки", () => {
    expect(priceLine(line({ qty: 3 }), soroca)).toEqual({
      unit: 105,
      total: 315,
    });
  });

  it("убрать ингредиент — бесплатно", () => {
    expect(
      priceLine(line({ removedIds: ["rosii", "ketchup"] }), soroca)?.unit,
    ).toBe(105);
  });

  it("несколько добавок складываются", () => {
    // 105 + becon 15 + cașcaval felii 6 + castraveți 2
    expect(
      priceLine(
        line({ addonIds: ["becon", "cascaval-felii", "castraveti-felii"] }),
        soroca,
      )?.unit,
    ).toBe(128);
  });

  it("соусник к салату разрешён, ингредиентная добавка — нет", () => {
    const salad = { productSlug: "salata-cezar" };
    expect(
      priceLine(line({ ...salad, addonIds: ["sosiera-ketchup"] }), soroca),
    ).not.toBeNull();
    expect(priceLine(line({ ...salad, addonIds: ["becon"] }), soroca)).toBe(
      null,
    );
  });

  it.each<[string, Partial<CartLine>]>([
    ["неизвестное блюдо", { productSlug: "shaorma" }],
    [
      "блюдо выключено в точке (пицца в Сороках)",
      { productSlug: "pizza-margarita" },
    ],
    ["у блюда с размерами не выбран размер", { productSlug: "kebab-xl-xxl" }],
    ["размер у блюда без размеров", { variantId: "xl" }],
    [
      "несуществующий размер",
      { productSlug: "kebab-xl-xxl", variantId: "xxxl" },
    ],
    ["неизвестная добавка", { addonIds: ["trufe"] }],
    ["добавка дважды", { addonIds: ["becon", "becon"] }],
    ["к напитку добавки нельзя", { productSlug: "cola", addonIds: ["becon"] }],
    ["убрать то, чего нет в составе", { removedIds: ["ananas"] }],
    ["количество 0", { qty: 0 }],
    ["количество 100", { qty: 100 }],
    ["дробное количество", { qty: 1.5 }],
  ])("невалидно → null: %s", (_, over) => {
    expect(priceLine(line(over), soroca)).toBeNull();
  });

  it("пицца в Бричанах считается", () => {
    expect(
      priceLine(line({ productSlug: "pizza-margarita" }), briceni),
    ).not.toBeNull();
  });
});

describe("cartTotal и pruneLines", () => {
  const lines = [
    line({ qty: 2 }),
    line({ productSlug: "cola" }),
    line({ productSlug: "pizza-margarita" }),
  ];

  it("итог — сумма валидных позиций", () => {
    const cola = soroca.products["cola"].price;
    expect(cartTotal(lines, soroca)).toBe(105 * 2 + cola);
  });

  it("pruneLines выкидывает то, что точка не продаёт", () => {
    expect(pruneLines(lines, soroca).map((l) => l.productSlug)).toEqual([
      "kebab-cheese",
      "cola",
    ]);
    expect(pruneLines(lines, briceni)).toHaveLength(3);
  });
});

describe("buildCatalog — каталог города для листа блюда", () => {
  it("Сороки без пиццы, Бричаны с пиццей", () => {
    expect(soroca.products["pizza-margarita"]).toBeUndefined();
    expect(briceni.products["pizza-margarita"]).toBeDefined();
  });

  it("кебабу разрешены ингредиенты и соусники, напиткам — ничего", () => {
    const kebab = soroca.products["kebab-cheese"].addonIds;
    expect(kebab).toContain("becon");
    expect(kebab).toContain("sosiera-ketchup");
    expect(soroca.products["cola"].addonIds).toEqual([]);
  });

  it("все 18 добавок в справочнике", () => {
    expect(Object.keys(soroca.addons)).toHaveLength(18);
  });

  it("размеры фото из images.json; нет фото → null", () => {
    const photo = soroca.products["kebab-cheese"].photo;
    expect(photo?.slug).toBe("kebab-cheese");
    expect(photo?.width).toBeGreaterThan(0);
    expect(photo?.sizes.length).toBeGreaterThan(0);
    expect(soroca.products["latte"].photo).toBeNull();
  });
});
