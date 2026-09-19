import { describe, expect, it } from "vitest";
import { getMessages } from "@/i18n/messages";
import { buildPointCatalog } from "./catalog";
import { describeParts, lineParts } from "./describe";

const catalog = buildPointCatalog("soroca-centru", { photos: false });

describe("описание позиции", () => {
  it("размер · Extra · Sos aparte · Fără — по языку", () => {
    const parts = lineParts(
      {
        productSlug: "kebab-xl-xxl",
        variantId: "xxl",
        addonIds: ["sos-usturoi", "sosiera-ketchup"],
        removedIds: ["rosii"],
        qty: 1,
      },
      catalog,
    );
    expect(parts).not.toBeNull();
    expect(describeParts(parts!, "ro", getMessages("ro"))).toBe(
      "XXL · Extra: Sos de usturoi (în preparat) · Sos aparte: Sosieră ketchup · Fără: roșii",
    );
    expect(describeParts(parts!, "ru", getMessages("ru"))).toContain(
      "Соус отдельно: Соусник кетчуп",
    );
  });

  it("блюдо не из каталога точки → null", () => {
    const pizza = {
      productSlug: "pizza-margarita",
      variantId: null,
      addonIds: [],
      removedIds: [],
      qty: 1,
    };
    expect(lineParts(pizza, catalog)).toBeNull();
  });
});
