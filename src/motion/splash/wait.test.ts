import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitUpTo } from "./wait";

// Нажатие на чип, когда ролик ещё грузится: заставка ждёт не дольше 150 мс
// (решение архитектора 25.09.2026), потом — обычный переход без неё.
describe("ожидание с пределом", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("успело — отдаёт результат", async () => {
    const late = new Promise<string>((resolve) =>
      setTimeout(() => resolve("ролик"), 100),
    );
    const result = waitUpTo(late, 150, null);
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe("ролик");
  });

  it("не успело — отдаёт запасное значение ровно по пределу", async () => {
    const never = new Promise<string>(() => {});
    let done: string | null | undefined;
    void waitUpTo(never, 150, null).then((value) => {
      done = value;
    });
    await vi.advanceTimersByTimeAsync(149);
    expect(done).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(null);
  });

  it("загрузка упала — запасное значение, без ошибки", async () => {
    const failed = Promise.reject(new Error("сеть"));
    const result = waitUpTo(failed, 150, null);
    await expect(result).resolves.toBe(null);
  });
});
