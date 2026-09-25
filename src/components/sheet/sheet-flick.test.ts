import { describe, expect, it } from "vitest";
import {
  CLOSE_VELOCITY,
  FLICK_WINDOW_MS,
  flickVelocity,
  isFlick,
  pushSample,
  type DragSample,
} from "./sheet-flick";

/** Палец идёт вниз с постоянной скоростью; датчик отдаёт точку каждые stepMs. */
function swipe(
  speed: number,
  stepMs: number,
  durationMs: number,
  jitter: (i: number) => number = () => 0,
): DragSample[] {
  const samples: DragSample[] = [];
  for (let i = 0, t = 0; t <= durationMs; i++, t = i * stepMs)
    pushSample(samples, { t, y: speed * t + jitter(i) });
  return samples;
}

describe("смах листа", () => {
  it("спокойный смах 0.2 px/мс на телефоне 120 Гц с дрожанием датчика закрывает лист", () => {
    // Дрожание ±1 px на каждой точке: на двух соседних точках (8 мс) оно
    // одно даёт 0.25 px/мс — больше порога, поэтому скорость берётся за окно.
    const samples = swipe(0.2, 1000 / 120, 300, (i) => (i % 2 ? 1 : -1));
    const last = samples[samples.length - 1];
    expect(flickVelocity(samples)).toBeGreaterThan(CLOSE_VELOCITY);
    expect(isFlick(samples, last.t + 8)).toBe(true);
  });

  it("палец замедлился на последних точках — смах всё равно считается", () => {
    const samples = swipe(0.2, 1000 / 120, 300);
    const last = samples[samples.length - 1];
    // Последние 16 мс палец почти стоит (0.02 px/мс), как перед отрывом
    pushSample(samples, { t: last.t + 8, y: last.y + 0.2 });
    pushSample(samples, { t: last.t + 16, y: last.y + 0.3 });
    expect(isFlick(samples, last.t + 20)).toBe(true);
  });

  it("точки редкие (60 Гц, пропуски кадров) — скорость та же", () => {
    const samples = swipe(0.2, 50, 300);
    expect(flickVelocity(samples)).toBeCloseTo(0.2, 5);
  });

  it("медленное перетаскивание 0.05 px/мс — не смах", () => {
    const samples = swipe(0.05, 1000 / 120, 600);
    const last = samples[samples.length - 1];
    expect(isFlick(samples, last.t + 8)).toBe(false);
  });

  it("палец остановился дольше окна и оторвался — не смах", () => {
    const samples = swipe(0.3, 1000 / 120, 200);
    const last = samples[samples.length - 1];
    expect(isFlick(samples, last.t + FLICK_WINDOW_MS + 50)).toBe(false);
  });

  it("палец пошёл обратно вверх — не смах", () => {
    const samples = swipe(0.3, 1000 / 120, 200);
    const last = samples[samples.length - 1];
    for (let i = 1; i <= 12; i++)
      pushSample(samples, { t: last.t + i * 8, y: last.y - i * 3 });
    expect(isFlick(samples, last.t + 100)).toBe(false);
  });

  it("одна точка — скорость ноль", () => {
    expect(flickVelocity([{ t: 0, y: 0 }])).toBe(0);
  });

  it("хранятся только точки окна и одна перед ним", () => {
    const samples = swipe(0.2, 10, 1000);
    const last = samples[samples.length - 1];
    expect(last.t - samples[1].t).toBeLessThanOrEqual(FLICK_WINDOW_MS);
    expect(samples.length).toBeLessThanOrEqual(FLICK_WINDOW_MS / 10 + 2);
  });
});
