import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isMotionPaused,
  motionPauseReasons,
  onMotionPauseChange,
  pauseMotion,
  resetMotionPauses,
  resumeMotion,
} from "./pause";

describe("паузы движка по причинам", () => {
  beforeEach(() => resetMotionPauses());

  it("без причин движок идёт", () => {
    expect(isMotionPaused()).toBe(false);
    expect(motionPauseReasons()).toEqual([]);
  });

  it("любая причина останавливает, снятие всех — запускает", () => {
    pauseMotion("sheet");
    expect(isMotionPaused()).toBe(true);
    pauseMotion("cart");
    expect(motionPauseReasons()).toEqual(["cart", "sheet"]);
    resumeMotion("sheet");
    expect(isMotionPaused()).toBe(true);
    resumeMotion("cart");
    expect(isMotionPaused()).toBe(false);
  });

  it("одна причина дважды требует двух снятий (React монтирует дважды)", () => {
    pauseMotion("sheet");
    pauseMotion("sheet");
    resumeMotion("sheet");
    expect(isMotionPaused()).toBe(true);
    resumeMotion("sheet");
    expect(isMotionPaused()).toBe(false);
  });

  it("лишнее снятие безвредно", () => {
    resumeMotion("нет такой");
    expect(isMotionPaused()).toBe(false);
    expect(motionPauseReasons()).toEqual([]);
  });

  it("подписка срабатывает только на смену состояния", () => {
    const listener = vi.fn();
    const off = onMotionPauseChange(listener);
    pauseMotion("a");
    pauseMotion("b");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(true);
    resumeMotion("a");
    expect(listener).toHaveBeenCalledTimes(1);
    resumeMotion("b");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(false);
    off();
    pauseMotion("c");
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
