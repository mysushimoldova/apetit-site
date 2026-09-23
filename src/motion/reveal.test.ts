import { describe, expect, it } from "vitest";
import { MAX_DELAYED_COLUMNS, revealDelay } from "./reveal";

describe("задержка появления по колонкам", () => {
  it("первая колонка появляется сразу", () => {
    expect(revealDelay(0, 70)).toBe(0);
  });

  it("каждая следующая колонка ждёт на шаг дольше", () => {
    expect(revealDelay(1, 70)).toBe(70);
    expect(revealDelay(2, 70)).toBe(140);
  });

  it("дальше третьего шага каскад не растёт (docs/MOTION.md §2)", () => {
    // На компьютере колонок четыре: четвёртая появляется вместе с третьей
    expect(revealDelay(3, 70)).toBe(140);
    expect(revealDelay(4, 70)).toBe(140);
    expect(revealDelay(99, 70)).toBe(140);
  });

  it("шаг берётся из настроек", () => {
    expect(revealDelay(1, 0)).toBe(0);
    expect(revealDelay(2, 40)).toBe(80);
    expect(revealDelay(3, 200)).toBe(MAX_DELAYED_COLUMNS * 200);
  });

  it("странные значения не ломают расчёт", () => {
    expect(revealDelay(-1, 70)).toBe(0);
    expect(revealDelay(Number.NaN, 70)).toBe(0);
    expect(revealDelay(1, Number.NaN)).toBe(0);
    // Дробный номер колонки (измерение с округлением) — берём ближайший
    expect(revealDelay(1.4, 70)).toBe(70);
    expect(revealDelay(1.6, 70)).toBe(140);
  });
});
