import { describe, expect, it } from "vitest";
import {
  liftAtRest,
  liftFrame,
  liftTarget,
  LIFT_MAX,
  restLift,
  stepLift,
  type LiftState,
} from "./lift";

const TUNING = { smooth: 0.13, sensitivity: 12, settle: 130 };

const SETTINGS = {
  enabled: true,
  amt: 0.9,
  smooth: 0.13,
  shadowReact: 0.7,
  rise: 7,
  sensitivity: 12,
  settle: 130,
  grow: 1.5,
  tilt: 1,
};

/** Прокрутка на speed пикселей за кадр в течение frames кадров. */
function scrollFor(
  state: LiftState,
  speed: number,
  frames: number,
  dt = 16.67,
): { state: LiftState; scrollY: number } {
  let scrollY = state.scroll;
  let next = state;
  for (let i = 0; i < frames; i++) {
    scrollY += speed;
    next = stepLift(next, scrollY, dt, TUNING);
  }
  return { state: next, scrollY };
}

describe("подъём при прокрутке (aterizare)", () => {
  it("стоим на месте — подъёма нет", () => {
    const { state } = scrollFor(restLift(), 0, 60);
    expect(state.lift).toBe(0);
    expect(state.vel).toBe(0);
    expect(liftAtRest(state)).toBe(true);
  });

  it("цель подъёма растёт со скоростью и упирается в 1", () => {
    expect(liftTarget(0, 12)).toBe(0);
    expect(liftTarget(6, 12)).toBeCloseTo(0.393, 3);
    expect(liftTarget(12, 12)).toBeCloseTo(0.632, 3);
    expect(liftTarget(120, 12)).toBeGreaterThan(0.999);
    expect(liftTarget(1e6, 12)).toBeLessThanOrEqual(1);
    // Вверх и вниз — одинаково: важна величина, не знак
    expect(liftTarget(-30, 12)).toBe(liftTarget(30, 12));
  });

  it("на быстрой прокрутке поднимается за несколько кадров", () => {
    const { state } = scrollFor(restLift(), 40, 12);
    expect(state.lift).toBeGreaterThan(0.5);
    expect(state.lift).toBeLessThanOrEqual(LIFT_MAX);
  });

  it("медленная прокрутка поднимает слабее быстрой", () => {
    const slow = scrollFor(restLift(), 6, 20).state.lift;
    const fast = scrollFor(restLift(), 40, 20).state.lift;
    expect(slow).toBeGreaterThan(0);
    expect(slow).toBeLessThan(fast);
  });

  it("после остановки садится в ноль и не уходит в минус", () => {
    const started = scrollFor(restLift(), 40, 20);
    const scrollY = started.scrollY;
    let state = started.state;
    expect(state.lift).toBeGreaterThan(0.5);
    let min = state.lift;
    // Полторы секунды покоя
    for (let i = 0; i < 90; i++) {
      state = stepLift(state, scrollY, 16.67, TUNING);
      min = Math.min(min, state.lift);
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(state.lift).toBeLessThan(0.003);
    expect(liftAtRest(state)).toBe(true);
  });

  it("садится медленнее, чем взлетает", () => {
    // Сколько кадров нужно, чтобы подняться на 0.25 от нуля…
    let up = 0;
    let state = restLift();
    let scrollY = 0;
    while (state.lift < 0.25 && up < 300) {
      scrollY += 40;
      state = stepLift(state, scrollY, 16.67, TUNING);
      up++;
    }
    // …и чтобы опустить те же 0.25 после остановки
    const settled = scrollFor(restLift(), 40, 40);
    let down = 0;
    let falling = settled.state;
    const from = falling.lift;
    while (falling.lift > from - 0.25 && down < 300) {
      falling = stepLift(falling, settled.scrollY, 16.67, TUNING);
      down++;
    }
    expect(up).toBeLessThan(down);
  });

  it("подъём никогда не выходит за 0…1.2", () => {
    const started = scrollFor(restLift(), 400, 60);
    const scrollY = started.scrollY;
    let state = started.state;
    expect(state.lift).toBeLessThanOrEqual(LIFT_MAX);
    for (let i = 0; i < 200; i++) {
      state = stepLift(state, scrollY, 16.67, TUNING);
      expect(state.lift).toBeGreaterThanOrEqual(0);
      expect(state.lift).toBeLessThanOrEqual(LIFT_MAX);
    }
  });

  it("при 30 кадрах в секунду подъём тот же, что при 60", () => {
    // Один и тот же путь: 60 кадров по 10 px или 30 кадров по 20 px
    const at60 = scrollFor(restLift(), 10, 60, 16.67).state;
    const at30 = scrollFor(restLift(), 20, 30, 33.33).state;
    // Расхождение только от того, что цель прыгает вдвое реже и вдвое дальше
    expect(Math.abs(at30.scroll / at60.scroll - 1)).toBeLessThan(0.02);
    expect(at30.lift).toBeCloseTo(at60.lift, 1);
  });

  it("кадр нулевой длины (движок стоит) — мгновенный покой", () => {
    const { state, scrollY } = scrollFor(restLift(), 40, 20);
    expect(state.lift).toBeGreaterThan(0);
    const still = stepLift(state, scrollY, 0, TUNING);
    expect(still).toEqual(restLift(scrollY));
  });
});

describe("подъём в значениях для DOM", () => {
  it("нулевой подъём даёт тождественное преобразование", () => {
    const frame = liftFrame(restLift(), SETTINGS);
    expect(frame.photo).toBe(
      "translate3d(0, 0.00px, 0) scale(1.0000) rotateX(0.00deg)",
    );
    expect(frame.shadow).toBe("translate3d(0, 0.00px, 0) scaleX(1.000)");
    // Тень целиком в состоянии покоя
    expect(frame.mix).toBe(0);
  });

  it("на подъёме фото идёт вверх и растёт, тень перетекает", () => {
    const state: LiftState = { scroll: 0, vel: 40, lift: 1, liftV: 0 };
    const frame = liftFrame(state, SETTINGS);
    // rise 7 × intensitate 0.9 = 6.3 px вверх
    expect(frame.photo).toContain("-6.30px");
    expect(frame.photo).toContain("scale(1.0135)");
    // Вниз (vel > 0) — наклон в другую сторону
    expect(frame.photo).toContain("rotateX(-0.90deg)");
    expect(frame.shadow).toContain("2.10px");
    expect(frame.shadow).toContain("scaleX(1.112)");
    expect(frame.mix).toBeCloseTo(1 / LIFT_MAX, 6);
  });

  it("доля перехода тени идёт от 0 до 1 и дальше не растёт", () => {
    const at = (lift: number) =>
      liftFrame({ scroll: 0, vel: 40, lift, liftV: 0 }, SETTINGS).mix;
    expect(at(0)).toBe(0);
    expect(at(LIFT_MAX / 2)).toBeCloseTo(0.5, 6);
    expect(at(LIFT_MAX)).toBe(1);
    // Пружина выше потолка не поднимается, но на всякий случай
    expect(at(5)).toBe(1);
  });

  it("наклон следует за направлением прокрутки", () => {
    const down = liftFrame({ scroll: 0, vel: 20, lift: 1, liftV: 0 }, SETTINGS);
    const up = liftFrame({ scroll: 0, vel: -20, lift: 1, liftV: 0 }, SETTINGS);
    expect(down.photo).toContain("rotateX(-0.90deg)");
    expect(up.photo).toContain("rotateX(0.90deg)");
  });

  it("нулевая интенсивность — эффекта нет", () => {
    const state: LiftState = { scroll: 0, vel: 40, lift: 1, liftV: 0 };
    const frame = liftFrame(state, { ...SETTINGS, amt: 0 });
    expect(frame.photo).toBe(
      "translate3d(0, 0.00px, 0) scale(1.0000) rotateX(0.00deg)",
    );
  });
});
