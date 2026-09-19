import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Картинка фона (scripts/bg-lines.py build): WebP с альфой, 1600px, ≤150 КБ.
const file = readFileSync(
  new URL("../../public/img/bg/linii.webp", import.meta.url),
);

describe("public/img/bg/linii.webp", () => {
  it("весит не больше 150 КБ", () => {
    expect(file.length).toBeLessThanOrEqual(150 * 1024);
  });

  it("WebP шириной 1600px с прозрачностью", () => {
    expect(file.toString("latin1", 0, 4)).toBe("RIFF");
    expect(file.toString("latin1", 8, 12)).toBe("WEBP");
    const chunk = file.toString("latin1", 12, 16);
    if (chunk === "VP8X") {
      // Расширенный формат: флаг альфы и размер холста
      expect(file[20] & 0x10).toBe(0x10);
      expect(file.readUIntLE(24, 3) + 1).toBe(1600);
    } else {
      // Без потерь (VP8L): 14 бит ширины, 14 бит высоты, бит «есть альфа»
      expect(chunk).toBe("VP8L");
      const bits = file.readUInt32LE(21);
      expect((bits & 0x3fff) + 1).toBe(1600);
      expect((bits >>> 28) & 1).toBe(1);
    }
  });
});
