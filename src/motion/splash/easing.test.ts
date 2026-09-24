import { describe, expect, it } from "vitest";
import {
  cubicBezier,
  easeIn,
  easeOut,
  mix,
  progress,
  splashEase,
} from "./easing";

describe("кривые движения", () => {
  it("начало и конец закреплены", () => {
    for (const curve of [easeIn, easeOut]) {
      expect(curve(0)).toBe(0);
      expect(curve(1)).toBe(1);
      expect(curve(-1)).toBe(0);
      expect(curve(2)).toBe(1);
    }
  });

  it("кривая входа быстро стартует: к середине времени пройдено больше половины пути", () => {
    expect(easeIn(0.5)).toBeGreaterThan(0.8);
  });

  it("кривая ухода тоже опережает время, но мягче кривой входа", () => {
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
    expect(easeOut(0.5)).toBeLessThan(easeIn(0.5));
  });

  // Сторож против медленного старта (решение архитектора 24.09.2026): уход
  // обязан трогаться сразу, иначе он читается как залипание. Прежняя
  // cubic-bezier(.4, 0, .2, 1) давала за первые 10 % времени около 5 % пути.
  it("обе кривые трогаются сразу: за первые 10 % времени — не меньше 25 % пути", () => {
    for (const curve of [easeIn, easeOut]) {
      expect(curve(0.1)).toBeGreaterThanOrEqual(0.25);
    }
  });

  it("обе кривые только растут", () => {
    for (const curve of [easeIn, easeOut]) {
      let prev = -1;
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const v = curve(t);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    }
  });

  it("прямая линия равна самому времени", () => {
    const linear = cubicBezier(1 / 3, 1 / 3, 2 / 3, 2 / 3);
    for (const t of [0.15, 0.4, 0.73]) {
      expect(linear(t)).toBeCloseTo(t, 4);
    }
  });
});

describe("доля времени", () => {
  it("считается и зажимается", () => {
    expect(progress(160, 320)).toBe(0.5);
    expect(progress(400, 320)).toBe(1);
    expect(progress(-5, 320)).toBe(0);
  });

  it("нулевая длительность — сразу конец", () => {
    expect(progress(0, 0)).toBe(1);
  });
});

describe("смешивание", () => {
  it("идёт от начала к концу", () => {
    expect(mix(0.9, 1, 0)).toBe(0.9);
    expect(mix(0.9, 1, 1)).toBe(1);
    expect(mix(0, 10, 0.25)).toBe(2.5);
  });
});

// Кривая хозяина: по ней на заставке едут блюдо и жёлтый круг, и та же
// кривая вшита в сами ролики (scripts/splash-video/config.json → curve).
describe("кривая хозяина", () => {
  const DISH = [0.8, 0.15] as const; // плавный старт и замедление блюда
  const DISC = [1, 0.15] as const; // у круга свои

  it("начало и конец закреплены при любых настройках", () => {
    for (const [start, soft] of [DISH, DISC, [0, 0], [1, 1], [0.5, 0.5]]) {
      expect(splashEase(0, start, soft)).toBe(0);
      expect(splashEase(1, start, soft)).toBe(1);
      expect(splashEase(-1, start, soft)).toBe(0);
      expect(splashEase(2, start, soft)).toBe(1);
    }
  });

  it("только растёт", () => {
    let prev = -1;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const v = splashEase(p, DISH[0], DISH[1]);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("плавный старт и правда тормозит начало", () => {
    // Чем больше start, тем меньше пройдено за первую пятую времени
    const soft = 0.15;
    expect(splashEase(0.2, 1, soft)).toBeLessThan(splashEase(0.2, 0, soft));
    expect(splashEase(0.2, 0.8, soft)).toBeLessThan(0.2);
  });

  it("без плавного старта и без замедления это просто время", () => {
    for (const p of [0.25, 0.5, 0.75]) {
      expect(splashEase(p, 0, 0)).toBeCloseTo(p, 10);
    }
  });

  it("замедление к концу придерживает конец", () => {
    // Чем больше soft, тем круче кривая набирает в начале
    expect(splashEase(0.5, 0, 1)).toBeGreaterThan(splashEase(0.5, 0, 0));
  });
});
