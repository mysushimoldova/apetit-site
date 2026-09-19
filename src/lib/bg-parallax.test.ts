import { describe, expect, it } from "vitest";
import { BG_PARALLAX, bgOffset, bgTileHeight } from "./bg-parallax";

describe("сдвиг фоновых линий при прокрутке", () => {
  const period = bgTileHeight(1200); // плитка при кадре 1200px

  it("высота плитки — 1.125 ширины кадра (два кадра 16:9)", () => {
    expect(period).toBe(1350);
    expect(bgTileHeight(1600)).toBe(1800);
    expect(bgTileHeight(0)).toBe(0);
    expect(bgTileHeight(Number.NaN)).toBe(0);
  });

  it("0.35 от прокрутки, вверх", () => {
    expect(BG_PARALLAX).toBe(0.35);
    expect(bgOffset(1000, period)).toBeCloseTo(-350);
    expect(bgOffset(2000, period)).toBeCloseTo(-700);
  });

  it("наверху страницы слой на месте", () => {
    expect(bgOffset(0, period)).toBe(0);
    expect(Object.is(bgOffset(0, period), -0)).toBe(false);
  });

  it("через высоту плитки начинает заново (слой не кончается на длинном меню)", () => {
    const y = period / BG_PARALLAX; // прокрутка, на которой слой проехал период
    expect(bgOffset(y, period)).toBeCloseTo(0);
    expect(bgOffset(y + 1000, period)).toBeCloseTo(-350);
    for (const scroll of [5000, 12000, 30000]) {
      const off = bgOffset(scroll, period);
      expect(off).toBeLessThanOrEqual(0);
      expect(off).toBeGreaterThan(-period);
    }
  });

  it("пока высота не измерена или прокрутка отрицательная (отскок iOS) — 0", () => {
    expect(bgOffset(1000, 0)).toBe(0);
    expect(bgOffset(1000, Number.NaN)).toBe(0);
    expect(bgOffset(-40, period)).toBe(0);
  });
});
