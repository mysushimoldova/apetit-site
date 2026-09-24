import { describe, expect, it } from "vitest";
import { splashVisual, totalMs, type SplashTiming } from "./timeline";

/** Значения хозяина (src/config/motion.json → splash, эталон
 *  docs/motion/splash-demo.html, объект S). */
const S = (over: Partial<SplashTiming> = {}): SplashTiming => ({
  hold: 1000,
  fin: 400,
  fout: 500,
  exit: "fade",
  dish: { z0: 1.32, z1: 0.96, y0: 20, y1: 10, start: 0.8, soft: 0.15 },
  disc: { d0: 0.54, d1: 0.12, dstart: 1, dsoft: 0.15, delay: 0.2, y: 0 },
  ...over,
});

describe("вся заставка", () => {
  it("держится плюс уход", () => {
    expect(totalMs(1000, 500)).toBe(1500);
  });
});

describe("блюдо", () => {
  it("в нулевой момент — размер и высота начала", () => {
    const v = splashVisual(0, S());
    expect(v.dishScale).toBeCloseTo(1.32, 5);
    expect(v.dishY).toBeCloseTo(20, 5);
  });

  it("к концу показа — размер и высота конца", () => {
    const v = splashVisual(1000, S());
    expect(v.dishScale).toBeCloseTo(0.96, 5);
    expect(v.dishY).toBeCloseTo(10, 5);
  });

  it("только уменьшается и только поднимается — ни разу не наоборот", () => {
    let scale = Number.POSITIVE_INFINITY;
    let y = Number.POSITIVE_INFINITY;
    for (let t = 0; t <= 1000; t += 25) {
      const v = splashVisual(t, S());
      expect(v.dishScale).toBeLessThanOrEqual(scale + 1e-9);
      expect(v.dishY).toBeLessThanOrEqual(y + 1e-9);
      scale = v.dishScale;
      y = v.dishY;
    }
  });

  // Плавный старт 0.8 — кривая трогается медленно: это подобрано хозяином и
  // ровно так же вшито в ролик (scripts/splash-video/config.json → curve).
  it("плавный старт: за первую пятую времени пройдено меньше пятой части пути", () => {
    const v = splashVisual(200, S());
    const passed = (1.32 - v.dishScale) / (1.32 - 0.96);
    expect(passed).toBeLessThan(0.2);
    expect(passed).toBeGreaterThan(0);
  });
});

describe("жёлтый круг", () => {
  it("в нулевой момент — свой начальный диаметр", () => {
    expect(splashVisual(0, S()).disc).toBeCloseTo(0.54, 5);
  });

  it("к концу показа — конечный диаметр", () => {
    expect(splashVisual(1000, S()).disc).toBeCloseTo(0.12, 5);
  });

  // Задержка 0.20: первые 200 мс из 1000 круг стоит на месте, потом едет.
  it("трогается позже блюда", () => {
    expect(splashVisual(200, S()).disc).toBeCloseTo(0.54, 5);
    expect(splashVisual(199, S()).disc).toBeCloseTo(0.54, 5);
    expect(splashVisual(400, S()).disc).toBeLessThan(0.54);
    // Блюдо в эти же 200 мс уже поехало
    expect(splashVisual(200, S()).dishScale).toBeLessThan(1.32);
  });

  it("высота круга — из настроек, она не меняется", () => {
    const high = S({ disc: { ...S().disc, y: -40 } });
    expect(splashVisual(0, high).discY).toBe(-40);
    expect(splashVisual(900, high).discY).toBe(-40);
  });

  // Ползунок задержки доходит только до 0.6, но деления на ноль в формуле
  // быть не должно: при задержке в единицу круг просто сразу конечного
  // размера (как в эталоне), а не NaN.
  it("задержка в единицу не ломает круг", () => {
    const still = S({ disc: { ...S().disc, delay: 1 } });
    expect(splashVisual(0, still).disc).toBeCloseTo(0.12, 5);
    expect(Number.isFinite(splashVisual(500, still).disc)).toBe(true);
  });
});

describe("появление", () => {
  // Решение архитектора 24.09.2026: пустого кремового кадра в начале нет.
  // Кривая входа набирает быстро — к 50 мс из 400 видно уже около половины.
  it("блюдо видно с первого кадра", () => {
    expect(splashVisual(50, S()).alpha).toBeGreaterThan(0.3);
  });

  it("к концу появления — полностью непрозрачно", () => {
    expect(splashVisual(400, S()).alpha).toBe(1);
    expect(splashVisual(900, S()).alpha).toBe(1);
  });

  it("кремовый экран непрозрачен с самого начала", () => {
    expect(splashVisual(0, S()).screenAlpha).toBe(1);
    expect(splashVisual(900, S()).screenAlpha).toBe(1);
  });
});

describe("уход", () => {
  it("затухание гасит всю заставку, ничего не двигая", () => {
    const mid = splashVisual(1000 + 250, S());
    expect(mid.alpha).toBeLessThan(1);
    expect(mid.alpha).toBeGreaterThan(0);
    expect(mid.screenAlpha).toBeLessThan(1);
    expect(mid.liftShare).toBe(0);
    expect(mid.zoomX).toBe(0);
    expect(mid.zoomY).toBe(0);
    expect(mid.visible).toBe(true);
  });

  it("к концу ухода заставки нет", () => {
    expect(splashVisual(1000 + 500, S()).visible).toBe(false);
  });

  // docs/MOTION.md §3: уход трогается сразу, иначе читается как залипание.
  it("за первые 10 % времени ухода пройдено больше четверти пути", () => {
    const early = splashVisual(1000 + 50, S());
    expect(1 - early.screenAlpha).toBeGreaterThan(0.25);
  });

  it("во время ухода блюдо и круг стоят там, где их застали", () => {
    const at = splashVisual(1000, S());
    const later = splashVisual(1000 + 250, S());
    expect(later.dishScale).toBeCloseTo(at.dishScale, 5);
    expect(later.disc).toBeCloseTo(at.disc, 5);
  });

  it("касание в середине — уход начинается сразу, движение замирает", () => {
    const tap = 600;
    const atTap = splashVisual(tap, S(), tap);
    expect(atTap.screenAlpha).toBe(1);
    const after = splashVisual(tap + 250, S(), tap);
    expect(after.screenAlpha).toBeLessThan(1);
    expect(after.dishScale).toBeCloseTo(atTap.dishScale, 5);
    expect(splashVisual(tap + 500, S(), tap).visible).toBe(false);
  });

  it("«шторка вверх» поднимает всю заставку", () => {
    const mid = splashVisual(1000 + 250, S({ exit: "lift" }));
    expect(mid.liftShare).toBeGreaterThan(0);
    expect(mid.liftShare).toBeLessThan(1);
    expect(mid.screenAlpha).toBe(1);
  });

  it("«уезжает в меню» уменьшает блюдо и уводит его влево и вниз", () => {
    const mid = splashVisual(1000 + 250, S({ exit: "zoom" }));
    expect(mid.dishScale).toBeLessThan(splashVisual(1000, S()).dishScale);
    expect(mid.zoomX).toBeLessThan(0);
    expect(mid.zoomY).toBeGreaterThan(0);
    expect(mid.alpha).toBeLessThan(1);
  });
});
