import { describe, expect, it } from "vitest";
import { billboardWidthEm } from "./billboard-fit";

// Контрольные ширины слов, замеренные в браузере (Oswald 600, заглавные,
// letter-spacing −0.01em), в долях размера шрифта.
describe("ширина слова-вывески в em", () => {
  it("совпадает с замером браузера (±1 %)", () => {
    const measured: [string, number][] = [
      ["Kebab", 2.624],
      ["Sandwich", 4.23],
      ["Pizza", 2.19],
      ["Hot Dog", 3.508],
      ["Gözleme", 3.505],
      ["Сэндвич", 4.076],
      ["Хот-дог", 3.468],
    ];
    for (const [word, em] of measured) {
      expect(billboardWidthEm(word), word).toBeGreaterThan(em * 0.99);
      expect(billboardWidthEm(word), word).toBeLessThan(em * 1.01);
    }
  });

  it("регистр не важен — слово всё равно рисуется заглавными", () => {
    expect(billboardWidthEm("kebab")).toBe(billboardWidthEm("KEBAB"));
  });

  it("неизвестная буква берётся с запасом (как самая широкая обычная)", () => {
    expect(billboardWidthEm("Ω")).toBeGreaterThanOrEqual(0.8);
  });
});
