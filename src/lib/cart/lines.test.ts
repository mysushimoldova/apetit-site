import { describe, expect, it } from "vitest";
import {
  MAX_QTY,
  addLine,
  countOf,
  decrementProduct,
  lineKey,
  parsePersistedCart,
  removeLine,
  setLineQty,
  type CartLine,
  type LineConfig,
} from "./lines";

const base = (productSlug: string): LineConfig => ({
  productSlug,
  variantId: null,
  addonIds: [],
  removedIds: [],
});

const xxlGarlic: LineConfig = {
  productSlug: "kebab-xl-xxl",
  variantId: "xxl",
  addonIds: ["sos-usturoi", "becon"],
  removedIds: [],
};

describe("сложение одинаковых конфигураций", () => {
  it("одинаковая конфигурация — одна позиция, количество складывается", () => {
    let lines: CartLine[] = [];
    lines = addLine(lines, xxlGarlic, 2);
    lines = addLine(lines, xxlGarlic, 1);
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(3);
  });

  it("порядок добавок и убранных не важен", () => {
    let lines = addLine([], xxlGarlic);
    lines = addLine(lines, {
      ...xxlGarlic,
      addonIds: ["becon", "sos-usturoi"],
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(2);
    expect(lineKey(xxlGarlic)).toBe(
      lineKey({ ...xxlGarlic, addonIds: ["becon", "sos-usturoi"] }),
    );
  });

  it("повторы внутри списка добавок не считаются дважды", () => {
    const lines = addLine([], {
      ...xxlGarlic,
      addonIds: ["becon", "becon", "sos-usturoi"],
    });
    expect(lines[0].addonIds).toEqual(["becon", "sos-usturoi"]);
  });

  it("другой размер, другие добавки или «без» — отдельные позиции", () => {
    let lines = addLine([], base("kebab-cheese"));
    lines = addLine(lines, { ...base("kebab-cheese"), removedIds: ["rosii"] });
    lines = addLine(lines, { ...base("kebab-cheese"), addonIds: ["becon"] });
    lines = addLine(lines, xxlGarlic);
    lines = addLine(lines, { ...xxlGarlic, variantId: "xl" });
    expect(lines).toHaveLength(5);
  });

  it(`не больше ${MAX_QTY} шт. в позиции`, () => {
    let lines = addLine([], base("cola"), 98);
    lines = addLine(lines, base("cola"), 5);
    expect(lines[0].qty).toBe(MAX_QTY);
    expect(setLineQty(lines, lineKey(base("cola")), 500)[0].qty).toBe(MAX_QTY);
  });

  it("количество 0 и меньше ничего не добавляет", () => {
    expect(addLine([], base("cola"), 0)).toEqual([]);
  });
});

describe("изменение количества и удаление", () => {
  it("setLineQty меняет количество; 0 — удаляет позицию", () => {
    const key = lineKey(xxlGarlic);
    const lines = addLine([], xxlGarlic);
    expect(setLineQty(lines, key, 4)[0].qty).toBe(4);
    expect(setLineQty(lines, key, 0)).toEqual([]);
  });

  it("removeLine удаляет только свою позицию", () => {
    let lines = addLine([], xxlGarlic);
    lines = addLine(lines, base("cola"));
    const after = removeLine(lines, lineKey(xxlGarlic));
    expect(after).toHaveLength(1);
    expect(after[0].productSlug).toBe("cola");
  });

  it("countOf считает все штуки блюда во всех настройках", () => {
    let lines = addLine([], base("kebab-cheese"), 2);
    lines = addLine(lines, { ...base("kebab-cheese"), removedIds: ["rosii"] });
    lines = addLine(lines, base("cola"), 5);
    expect(countOf(lines, "kebab-cheese")).toBe(3);
    expect(countOf(lines, "fanta")).toBe(0);
  });

  it("«−» на плитке сначала убирает базовую позицию, потом последнюю другую", () => {
    let lines = addLine([], base("kebab-cheese"));
    lines = addLine(lines, { ...base("kebab-cheese"), removedIds: ["rosii"] });
    lines = addLine(lines, { ...base("kebab-cheese"), addonIds: ["becon"] });
    lines = decrementProduct(lines, "kebab-cheese");
    // базовой больше нет, две настроенные остались
    expect(lines.map((l) => l.removedIds.length + l.addonIds.length)).toEqual([
      1, 1,
    ]);
    lines = decrementProduct(lines, "kebab-cheese");
    expect(lines).toHaveLength(1);
    expect(lines[0].removedIds).toEqual(["rosii"]);
  });

  it("«−» уменьшает количество, а не удаляет, если штук больше одной", () => {
    const lines = decrementProduct(addLine([], base("cola"), 3), "cola");
    expect(lines[0].qty).toBe(2);
  });
});

describe("parsePersistedCart — то, что лежит в localStorage", () => {
  const good = {
    city: "soroca",
    lines: [{ ...xxlGarlic, qty: 2 }],
  };

  it("правильные данные читаются как есть", () => {
    expect(parsePersistedCart(good)).toEqual({
      city: "soroca",
      lines: [{ ...xxlGarlic, addonIds: ["becon", "sos-usturoi"], qty: 2 }],
    });
  });

  it.each([
    ["undefined", undefined],
    ["строка", "мусор"],
    ["массив", [1, 2]],
    ["без lines", { city: "soroca" }],
  ])("мусор (%s) → пустая корзина", (_, value) => {
    expect(parsePersistedCart(value)).toEqual({ city: null, lines: [] });
  });

  it("неизвестный город → пустая корзина", () => {
    expect(parsePersistedCart({ ...good, city: "chisinau" })).toEqual({
      city: null,
      lines: [],
    });
  });

  it("битые позиции выкидываются, хорошие остаются", () => {
    const parsed = parsePersistedCart({
      city: "otaci",
      lines: [
        { ...base("cola"), qty: 0 },
        { ...base("cola"), qty: 1000 },
        { ...base("cola"), qty: 1.5 },
        { ...base("Cola!"), qty: 1 },
        { productSlug: "fanta", qty: 1 },
        null,
        { ...base("sprite"), qty: 2 },
      ],
    });
    expect(parsed.city).toBe("otaci");
    expect(parsed.lines).toEqual([{ ...base("sprite"), qty: 2 }]);
  });

  it("повторяющиеся позиции склеиваются", () => {
    const parsed = parsePersistedCart({
      city: "soroca",
      lines: [
        { ...base("cola"), qty: 1 },
        { ...base("cola"), qty: 2 },
      ],
    });
    expect(parsed.lines).toEqual([{ ...base("cola"), qty: 3 }]);
  });
});
