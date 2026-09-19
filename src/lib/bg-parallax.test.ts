import { describe, expect, it } from "vitest";
import { BG_PARALLAX, bgOffset } from "./bg-parallax";

describe("сдвиг фоновых линий при прокрутке", () => {
  const period = 1688; // два экрана по 844px

  it("0.35 от прокрутки, вверх", () => {
    expect(BG_PARALLAX).toBe(0.35);
    expect(bgOffset(1000, period)).toBeCloseTo(-350);
    expect(bgOffset(2000, period)).toBeCloseTo(-700);
  });

  it("наверху страницы слой на месте", () => {
    expect(bgOffset(0, period)).toBe(0);
    expect(Object.is(bgOffset(0, period), -0)).toBe(false);
  });

  it("через два экрана начинает заново (слой не кончается на длинном меню)", () => {
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
