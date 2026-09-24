import { describe, expect, it } from "vitest";
import {
  HEIGHT_SHARE,
  splashDishWidth,
  splashRate,
  VIDEO_MS,
  WIDTH_SHARE,
} from "./geometry";

// Ролики переснял хозяин 24.09.2026: 60 кадров = ровно 1.0 с, кривая
// поворота вшита в файл. На сайте ролик просто играет — никаких перемоток
// и подгонки скорости по ходу.
describe("скорость ролика", () => {
  it("ролик — ровно секунда", () => {
    expect(VIDEO_MS).toBe(1000);
  });

  it("длительность 1000 — обычная скорость", () => {
    expect(splashRate(1000)).toBe(1);
  });

  it("заставка вдвое короче — ролик вдвое быстрее", () => {
    expect(splashRate(500)).toBe(2);
  });

  it("заставка вдвое длиннее — вдвое медленнее", () => {
    expect(splashRate(2000)).toBe(0.5);
  });

  it("на краях ползунка скорость остаётся человеческой", () => {
    expect(splashRate(400)).toBeCloseTo(2.5, 5);
    expect(splashRate(4000)).toBeCloseTo(0.25, 5);
  });

  it("мусор вместо длительности не роняет заставку", () => {
    expect(splashRate(0)).toBe(1);
    expect(splashRate(Number.NaN)).toBe(1);
  });
});

describe("размер блюда", () => {
  const stage = { stageWidth: 390, stageHeight: 720 };

  it("на телефоне решает ширина экрана", () => {
    // Горизонтальный кадр 1.4: по высоте влезло бы 0.6 × 720 × 1.4 = 605
    const w = splashDishWidth({ ...stage, aspect: 1.4 });
    expect(Math.round(w)).toBe(Math.round(WIDTH_SHARE * 390));
  });

  it("вертикальная бутылка ограничена высотой, а не шириной", () => {
    const w = splashDishWidth({ ...stage, aspect: 0.5 });
    expect(Math.round(w)).toBe(Math.round(HEIGHT_SHARE * 720 * 0.5));
  });

  it("невысокий экран уменьшает блюдо", () => {
    const low = splashDishWidth({
      stageWidth: 390,
      stageHeight: 380,
      aspect: 1,
    });
    expect(Math.round(low)).toBe(228);
  });

  it("кадра ещё нет — размера нет (рисовать нечего)", () => {
    expect(splashDishWidth({ ...stage, aspect: 0 })).toBe(0);
    expect(
      splashDishWidth({ stageWidth: 0, stageHeight: 0, aspect: 1.4 }),
    ).toBe(0);
  });
});
