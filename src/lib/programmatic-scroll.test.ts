import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SCROLL_IDLE_MS,
  SCROLL_START_MS,
  watchProgrammaticScroll,
} from "./programmatic-scroll";

describe("watchProgrammaticScroll", () => {
  let target: EventTarget;
  let onEnd: ReturnType<typeof vi.fn<(interrupted: boolean) => void>>;
  const fire = (type: string) => target.dispatchEvent(new Event(type));

  beforeEach(() => {
    vi.useFakeTimers();
    target = new EventTarget();
    onEnd = vi.fn<(interrupted: boolean) => void>();
  });
  afterEach(() => vi.useRealTimers());

  it("пока идут события scroll — прокрутка не закончена", () => {
    watchProgrammaticScroll(target, onEnd);
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(16);
      fire("scroll");
    }
    expect(onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SCROLL_IDLE_MS);
    expect(onEnd).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("scrollend заканчивает сразу, повторно onEnd не вызывается", () => {
    watchProgrammaticScroll(target, onEnd);
    fire("scroll");
    fire("scrollend");
    expect(onEnd).toHaveBeenCalledExactlyOnceWith(false);
    fire("scrollend");
    vi.advanceTimersByTime(SCROLL_IDLE_MS * 2);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("если прокрутки не было (секция уже на месте) — конец через SCROLL_START_MS", () => {
    watchProgrammaticScroll(target, onEnd);
    vi.advanceTimersByTime(SCROLL_START_MS - 1);
    expect(onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onEnd).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("первый scroll запоздал (браузер занят) — фиксация не снимается раньше", () => {
    watchProgrammaticScroll(target, onEnd);
    vi.advanceTimersByTime(SCROLL_IDLE_MS * 3);
    expect(onEnd).not.toHaveBeenCalled();
    fire("scroll");
    vi.advanceTimersByTime(SCROLL_IDLE_MS - 1);
    expect(onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onEnd).toHaveBeenCalledExactlyOnceWith(false);
  });

  it.each(["wheel", "touchstart", "pointerdown", "keydown"])(
    "%s от человека прерывает прокрутку",
    (type) => {
      watchProgrammaticScroll(target, onEnd);
      vi.advanceTimersByTime(0);
      fire("scroll");
      fire(type);
      expect(onEnd).toHaveBeenCalledExactlyOnceWith(true);
    },
  );

  it("нажатие, которое запустило прокрутку (Space → keydown), не прерывает", () => {
    watchProgrammaticScroll(target, onEnd);
    fire("keydown"); // тот же keydown ещё всплывает до window
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("отмена — без onEnd и без слушателей", () => {
    const stop = watchProgrammaticScroll(target, onEnd);
    vi.advanceTimersByTime(0);
    stop();
    fire("wheel");
    fire("scrollend");
    vi.advanceTimersByTime(SCROLL_IDLE_MS * 2);
    expect(onEnd).not.toHaveBeenCalled();
  });
});
