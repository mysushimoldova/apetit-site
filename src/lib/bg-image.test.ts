import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BG_TILE_HEIGHT_PER_FRAME } from "./bg-parallax";

// Картинка фона (scripts/bg-lines.py build): плитка 2×2 из кадра и его зеркал,
// WebP с альфой, 3200×1800, ≤250 КБ.
const file = readFileSync(
  new URL("../../public/img/bg/linii.webp", import.meta.url),
);

/** Ширина, высота и флаг альфы из заголовка WebP. */
function webpInfo(buf: Buffer) {
  expect(buf.toString("latin1", 0, 4)).toBe("RIFF");
  expect(buf.toString("latin1", 8, 12)).toBe("WEBP");
  const chunk = buf.toString("latin1", 12, 16);
  if (chunk === "VP8X") {
    // Расширенный формат: флаг альфы и размер холста
    return {
      width: buf.readUIntLE(24, 3) + 1,
      height: buf.readUIntLE(27, 3) + 1,
      alpha: (buf[20] & 0x10) === 0x10,
    };
  }
  // Без потерь (VP8L): 14 бит ширины, 14 бит высоты, бит «есть альфа»
  expect(chunk).toBe("VP8L");
  const bits = buf.readUInt32LE(21);
  return {
    width: (bits & 0x3fff) + 1,
    height: ((bits >>> 14) & 0x3fff) + 1,
    alpha: ((bits >>> 28) & 1) === 1,
  };
}

describe("public/img/bg/linii.webp", () => {
  it("весит не больше 250 КБ", () => {
    expect(file.length).toBeLessThanOrEqual(250 * 1024);
  });

  it("WebP 3200×1800 с прозрачностью", () => {
    expect(webpInfo(file)).toEqual({ width: 3200, height: 1800, alpha: true });
  });

  it("высота плитки = BG_TILE_HEIGHT_PER_FRAME ширин кадра (кадр — половина плитки)", () => {
    const { width, height } = webpInfo(file);
    expect(height / (width / 2)).toBe(BG_TILE_HEIGHT_PER_FRAME);
  });
});
