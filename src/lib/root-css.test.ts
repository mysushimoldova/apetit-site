import { describe, expect, it } from "vitest";
import type { ProductsSettings } from "@/motion/config-schema";
import { rootCss } from "./root-css";

const products: ProductsSettings = {
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
  reveal: { type: "lift", dur: 320, dist: 14, stagger: 70, shadowDelay: 100 },
  lift: {
    enabled: true,
    amt: 0.9,
    smooth: 0.1,
    shadowReact: 0.7,
    rise: 7,
    sensitivity: 10,
    settle: 130,
    grow: 1.5,
    tilt: 1,
  },
};

describe("переменные CSS правилом :root", () => {
  it("одно правило :root со всеми переменными страницы и карточек", () => {
    const css = rootCss("#F7F2EA", products);
    expect(css.startsWith(":root{")).toBe(true);
    expect(css.endsWith("}")).toBe(true);
    // Фон страницы и стекло от него же
    expect(css).toContain("--color-cream:#F7F2EA");
    expect(css).toContain("--glass-bg:rgba(247, 242, 234, 0.78)");
    expect(css).toContain("--glass-bg-fallback:rgba(247, 242, 234, 0.96)");
    // Карточки блюд
    expect(css).toContain("--sh-aw:93%");
    expect(css).toContain("--pv-dur:320ms");
    expect(css).toContain("--pv-stagger:70");
  });

  it("фигурная скобка внутри правила ровно одна пара", () => {
    const css = rootCss("#F1E9DB", products);
    expect(css.split("{")).toHaveLength(2);
    expect(css.split("}")).toHaveLength(2);
  });

  it("значение не может закрыть <style> или правило", () => {
    // Так выглядел бы motion.json, поправленный руками мимо проверки zod
    const broken = {
      ...products,
      shadow: {
        ...products.shadow,
        aw: "1}html{display:none" as unknown as number,
      },
    };
    const css = rootCss("#F7F2EA" as string, broken);
    expect(css).not.toContain("}html{");
    expect(css).toContain("--sh-aw:1htmldisplay:none%");
    // Правило по-прежнему одно
    expect(css.split("{")).toHaveLength(2);
  });

  it("угловые скобки из значения вырезаны", () => {
    const broken = {
      ...products,
      reveal: {
        ...products.reveal,
        dur: "1</style><script>alert(1)</script" as unknown as number,
      },
    };
    const css = rootCss("#F7F2EA", broken);
    expect(css).not.toContain("<");
    expect(css).not.toContain(">");
  });
});
