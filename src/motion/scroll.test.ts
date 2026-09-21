import { describe, expect, it } from "vitest";
import {
  ScrollSmoother,
  SCROLL_FRAME_MS,
  smoothingFactor,
  stepScroll,
} from "./scroll";

describe("сглаживание прокрутки", () => {
  it("за кадр 60 к/с проходит ровно долю ease", () => {
    expect(smoothingFactor(0.1, SCROLL_FRAME_MS)).toBeCloseTo(0.1, 12);
    expect(stepScroll(0, 1000, 0.1, SCROLL_FRAME_MS)).toBeCloseTo(100, 9);
  });

  it("инертность одинакова при 60 и 30 кадрах в секунду", () => {
    const long = stepScroll(0, 1000, 0.1, SCROLL_FRAME_MS * 2);
    const short = stepScroll(
      stepScroll(0, 1000, 0.1, SCROLL_FRAME_MS),
      1000,
      0.1,
      SCROLL_FRAME_MS,
    );
    expect(long).toBeCloseTo(short, 9);
  });

  it("крайние значения: ease 0 — стоит, ease 1 — сразу в цель", () => {
    expect(stepScroll(0, 1000, 0, SCROLL_FRAME_MS)).toBe(0);
    expect(stepScroll(0, 1000, 1, SCROLL_FRAME_MS)).toBe(1000);
  });

  it("кадр нулевой длины ничего не меняет", () => {
    expect(stepScroll(300, 1000, 0.1, 0)).toBe(300);
    expect(smoothingFactor(0.1, -5)).toBe(0);
  });

  it("никогда не перелетает цель", () => {
    let value = 0;
    for (let i = 0; i < 200; i++) value = stepScroll(value, 1000, 0.3, 40);
    expect(value).toBeLessThanOrEqual(1000);
    expect(value).toBeCloseTo(1000, 3);
  });

  it("ScrollSmoother: догоняет цель и встаёт в неё по reset", () => {
    const smoother = new ScrollSmoother(0.1);
    expect(smoother.value).toBe(0);
    for (let i = 0; i < 60; i++) smoother.update(500, SCROLL_FRAME_MS);
    expect(smoother.value).toBeGreaterThan(490);
    expect(smoother.value).toBeLessThan(500);
    smoother.reset(2000);
    expect(smoother.value).toBe(2000);
  });

  it("ScrollSmoother: инертность можно поменять на ходу (панель)", () => {
    const smoother = new ScrollSmoother(0.02);
    smoother.update(1000, SCROLL_FRAME_MS);
    const slow = smoother.value;
    smoother.reset(0);
    smoother.setEase(0.3);
    smoother.update(1000, SCROLL_FRAME_MS);
    expect(smoother.value).toBeGreaterThan(slow);
  });
});
