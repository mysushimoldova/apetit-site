import { describe, expect, it } from "vitest";
import {
  MAX_VIDEO_WIDTH,
  splashRate,
  splashSwitchTimes,
  splashVideoWidth,
  VIDEO_MS,
} from "./geometry";

describe("скорость ролика", () => {
  it("длительность равна ролику — обычная скорость", () => {
    expect(splashRate(VIDEO_MS)).toBe(1);
  });

  it("заставка короче — ролик идёт быстрее, но не более чем вдвое", () => {
    expect(splashRate(750)).toBe(2);
    expect(splashRate(300)).toBe(2);
  });

  it("заставка длиннее — медленнее, но не более чем вдвое", () => {
    expect(splashRate(3000)).toBe(0.5);
    expect(splashRate(3500)).toBe(0.5);
  });

  it("мусор вместо длительности не роняет заставку", () => {
    expect(splashRate(0)).toBe(2);
    expect(splashRate(Number.NaN)).toBe(2);
  });
});

describe("размер блюда", () => {
  const stage = { stageWidth: 390, stageHeight: 720 };

  it("на телефоне решает ширина экрана", () => {
    // Горизонтальный кадр 1.4: 0.83 × 390 = 323 → упирается в предел 320
    const w = splashVideoWidth({ ...stage, aspect: 1.4, zoom: 0.83 });
    expect(w).toBe(MAX_VIDEO_WIDTH);
  });

  it("вертикальная бутылка ограничена высотой, а не шириной", () => {
    // aspect 0.5: 0.6 × 720 × 0.5 = 216 — меньше, чем 0.83 × 390
    const w = splashVideoWidth({ ...stage, aspect: 0.5, zoom: 0.83 });
    expect(Math.round(w)).toBe(216);
  });

  it("невысокий экран уменьшает блюдо", () => {
    const low = splashVideoWidth({
      stageWidth: 390,
      stageHeight: 380,
      aspect: 1,
      zoom: 0.83,
    });
    expect(Math.round(low)).toBe(228);
  });

  it("меньше zoom — меньше блюдо", () => {
    const small = splashVideoWidth({ ...stage, aspect: 1.4, zoom: 0.45 });
    expect(Math.round(small)).toBe(176);
  });

  it("кадра ещё нет — размера нет (рисовать нечего)", () => {
    expect(splashVideoWidth({ ...stage, aspect: 0, zoom: 0.83 })).toBe(0);
  });
});

describe("смена блюда", () => {
  it("одно блюдо — переключений нет", () => {
    expect(splashSwitchTimes(1500, 1)).toEqual([]);
  });

  it("два блюда — второе приходит на середине", () => {
    expect(splashSwitchTimes(1500, 2)).toEqual([750]);
  });
});
