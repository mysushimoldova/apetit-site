import { describe, expect, it } from "vitest";
import type { ProductsSettings } from "@/motion/config-schema";
import { applyProductStyle, productVars, shadowTint } from "./product-style";

const SETTINGS: ProductsSettings = {
  shadow: {
    aw: 93,
    ah: 29,
    ab: 34,
    aa: 0.11,
    cw: 82,
    ch: 18,
    cb: 13,
    ca: 0.29,
    y: 3,
    tint: 0.25,
  },
  reveal: { type: "lift", dur: 360, dist: 14, stagger: 70, shadowDelay: 100 },
  lift: {
    enabled: true,
    amt: 0.9,
    smooth: 0.13,
    shadowReact: 0.7,
    rise: 7,
    sensitivity: 12,
    settle: 130,
    grow: 1.5,
    tilt: 1,
  },
};

describe("переменные CSS карточек блюд", () => {
  it("цвет тени — между тёплым чёрным и рыжим", () => {
    expect(shadowTint(0)).toBe("26 23 20");
    expect(shadowTint(1)).toBe("92 52 22");
    // 0.25 — выбор архитектора: #2B1E15
    expect(shadowTint(0.25)).toBe("43 30 21");
  });

  it("размеры тени идут в CSS с единицами", () => {
    const vars = productVars(SETTINGS);
    expect(vars["--sh-aw"]).toBe("93%");
    expect(vars["--sh-ah"]).toBe("29px");
    expect(vars["--sh-ab"]).toBe("34px");
    expect(vars["--sh-y"]).toBe("3px");
  });

  it("тень приходит готовой картинкой из двух градиентов", () => {
    const image = productVars(SETTINGS)["--sh-image"];
    // Сперва контактная (она сверху), потом широкая
    expect(image.split("radial-gradient").length - 1).toBe(2);
    expect(image).toContain("closest-side");
    // Прозрачность в середине контактной: 0.29 × 0.511
    expect(image).toContain("rgb(43 30 21 / 0.1482) 0%");
    // …и широкой: 0.11 × 0.31
    expect(image).toContain("rgb(43 30 21 / 0.0341) 0%");
    // По краю обе прозрачны
    expect(image.split("rgb(43 30 21 / 0) 100%").length - 1).toBe(2);
  });

  it("вторая картинка тени — как она выглядит на полном подъёме", () => {
    const image = productVars(SETTINGS)["--sh-image-lifted"];
    // shadowReact 0.7 × потолок подъёма 1.2 = 0.84
    // широкая: 0.11 × (1 + 0.4×0.84) = 0.147, в середине × 0.31
    expect(image).toContain("rgb(43 30 21 / 0.0456) 0%");
    // контактная: 0.29 × (1 − 0.9×0.84) = 0.0708, в середине × 0.511
    expect(image).toContain("rgb(43 30 21 / 0.0362) 0%");
  });

  it("контактная тень не уходит в отрицательную прозрачность", () => {
    const image = productVars({
      ...SETTINGS,
      lift: { ...SETTINGS.lift, shadowReact: 2 },
    })["--sh-image-lifted"];
    // Контактной на подъёме не остаётся совсем — все её стопы прозрачны
    expect(
      image.startsWith("radial-gradient(closest-side, rgb(43 30 21 / 0) 0%"),
    ).toBe(true);
    expect(image).not.toContain("/ -");
  });

  it("выключенная реакция тени оставляет её как в покое", () => {
    const vars = productVars({
      ...SETTINGS,
      lift: { ...SETTINGS.lift, shadowReact: 0 },
    });
    expect(vars["--sh-image-lifted"]).toBe(vars["--sh-image"]);
  });

  it("появление: откуда выезжает фото и тень", () => {
    expect(productVars(SETTINGS)["--pv-photo-from"]).toBe("translateY(14px)");
    expect(productVars(SETTINGS)["--pv-shadow-from"]).toBe("scaleX(0.8)");
    expect(productVars(SETTINGS)["--pv-dur"]).toBe("360ms");
    expect(productVars(SETTINGS)["--pv-shadow-delay"]).toBe("100ms");
    // Задержку колонок читает JS, поэтому она без единиц
    expect(productVars(SETTINGS)["--pv-stagger"]).toBe("70");
  });

  it("другие виды появления", () => {
    const scale = productVars({
      ...SETTINGS,
      reveal: { ...SETTINGS.reveal, type: "scale" },
    });
    expect(scale["--pv-photo-from"]).toBe("scale(0.94)");
    expect(scale["--pv-shadow-from"]).toBe("scaleX(0.7)");

    const none = productVars({
      ...SETTINGS,
      reveal: { ...SETTINGS.reveal, type: "none" },
    });
    expect(none["--pv-photo-from"]).toBe("none");
    expect(none["--pv-shadow-from"]).toBe("none");
  });

  it("применение к элементу ставит те же переменные", () => {
    const set: Record<string, string> = {};
    applyProductStyle(
      { style: { setProperty: (name, value) => (set[name] = value) } },
      SETTINGS,
    );
    expect(set).toEqual(productVars(SETTINGS));
  });
});
