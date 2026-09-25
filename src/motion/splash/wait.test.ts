import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDLE_TIMEOUT, idleQueue, waitUpTo } from "./wait";

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

// Предзагрузка без цены для главного потока (решение архитектора 25.09.2026):
// по одному файлу на кусок простоя, и только если в куске есть время.
describe("очередь по простоям", () => {
  type Idle = (deadline: IdleDeadline) => void;
  let idle: Idle[] = [];

  beforeEach(() => {
    idle = [];
    vi.stubGlobal("requestIdleCallback", (callback: Idle) => {
      idle.push(callback);
      return idle.length;
    });
    vi.stubGlobal("cancelIdleCallback", () => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Отдать очереди один кусок простоя с таким запасом времени. */
  async function runIdle(remaining: number, didTimeout = false) {
    const callback = idle.shift();
    callback?.({ didTimeout, timeRemaining: () => remaining });
    await Promise.resolve();
    await Promise.resolve();
  }

  /** Задача-загрузка, которую тест завершает сам. */
  function file() {
    let finish = () => {};
    const task = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    return { task, finish: () => finish() };
  }

  it("один файл на кусок, следующий — только когда скачан предыдущий", async () => {
    const a = file();
    const b = file();
    idleQueue([a.task, b.task]);
    expect(idle).toHaveLength(1);

    await runIdle(20);
    expect(a.task).toHaveBeenCalledTimes(1);
    expect(b.task).not.toHaveBeenCalled();
    // Пока первый файл качается, новый кусок простоя не просим
    expect(idle).toHaveLength(0);

    a.finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(idle).toHaveLength(1);
    await runIdle(20);
    expect(b.task).toHaveBeenCalledTimes(1);
  });

  it("в куске мало времени — файл ждёт следующего простоя", async () => {
    const a = file();
    idleQueue([a.task]);
    await runIdle(0.5);
    expect(a.task).not.toHaveBeenCalled();
    expect(idle).toHaveLength(1);
    await runIdle(20);
    expect(a.task).toHaveBeenCalledTimes(1);
  });

  it("браузер так и не простоял до предела — файл всё равно идёт", async () => {
    const a = file();
    idleQueue([a.task]);
    await runIdle(0, true);
    expect(a.task).toHaveBeenCalledTimes(1);
  });

  it("простои всё время короткие — файл идёт не позже IDLE_TIMEOUT от первой просьбы", async () => {
    // Фон движка рисует каждый кадр, и куски простоя бывают по 0.5 мс
    // подряд. Раньше каждая новая просьба начинала предел заново, и файл
    // не шёл никогда.
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const a = file();
    idleQueue([a.task]);
    for (; now < IDLE_TIMEOUT; now += 500) {
      await runIdle(0.5);
      expect(a.task).not.toHaveBeenCalled();
    }
    await runIdle(0.5);
    expect(a.task).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it("упавшая загрузка не останавливает очередь", async () => {
    const b = file();
    idleQueue([() => Promise.reject(new Error("сеть")), b.task]);
    await runIdle(20);
    await Promise.resolve();
    await runIdle(20);
    expect(b.task).toHaveBeenCalledTimes(1);
  });

  it("отмена — больше ничего не начинается", async () => {
    const a = file();
    const b = file();
    const cancel = idleQueue([a.task, b.task]);
    await runIdle(20);
    cancel();
    a.finish();
    await Promise.resolve();
    await Promise.resolve();
    await runIdle(20);
    expect(b.task).not.toHaveBeenCalled();
  });
});
