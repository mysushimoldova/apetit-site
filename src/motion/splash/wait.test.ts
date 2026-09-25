import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { afterMenuShown, fileQueue, START_DELAY, waitUpTo } from "./wait";

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

// Предзагрузка (решение архитектора 25.09.2026, B0): файлы идут по очереди,
// по одному, и следующий начинается сразу, как скачан предыдущий. Простоя
// страницы не ждём вовсе: линии фона рисуются постоянно, простоя почти нет,
// а в Safari requestIdleCallback нет совсем.
describe("очередь файлов", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Простой не нужен: если очередь его попросит — тест это увидит
    vi.stubGlobal(
      "requestIdleCallback",
      vi.fn(() => {
        throw new Error("очередь не должна ждать простоя");
      }),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

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

  it("первый файл — сразу, следующий — только когда скачан предыдущий", async () => {
    const a = file();
    const b = file();
    fileQueue([a.task, b.task]);
    await vi.advanceTimersByTimeAsync(0);
    expect(a.task).toHaveBeenCalledTimes(1);
    expect(b.task).not.toHaveBeenCalled();

    // Сколько бы ни прошло, пока первый качается, второй не начинается
    await vi.advanceTimersByTimeAsync(10_000);
    expect(b.task).not.toHaveBeenCalled();

    a.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(b.task).toHaveBeenCalledTimes(1);
  });

  it("между файлами нет пауз: 8 мгновенных файлов — без единого шага времени", async () => {
    const tasks = Array.from({ length: 8 }, () =>
      vi.fn(() => Promise.resolve()),
    );
    fileQueue(tasks);
    await vi.advanceTimersByTimeAsync(0);
    for (const task of tasks) expect(task).toHaveBeenCalledTimes(1);
    expect(requestIdleCallback).not.toHaveBeenCalled();
  });

  it("упавшая загрузка не останавливает очередь", async () => {
    const b = file();
    fileQueue([() => Promise.reject(new Error("сеть")), b.task]);
    await vi.advanceTimersByTimeAsync(0);
    expect(b.task).toHaveBeenCalledTimes(1);
  });

  it("отмена — больше ничего не начинается", async () => {
    const a = file();
    const b = file();
    const cancel = fileQueue([a.task, b.task]);
    await vi.advanceTimersByTimeAsync(0);
    cancel();
    a.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(b.task).not.toHaveBeenCalled();
  });

  it("отмена до первого файла — не начинается ничего", async () => {
    const a = file();
    const cancel = fileQueue([a.task]);
    cancel();
    await vi.advanceTimersByTimeAsync(0);
    expect(a.task).not.toHaveBeenCalled();
  });
});

// Когда начинать: через 1 с после отрисовки меню (после load и LCP), обычным
// таймером. Страница здесь поддельная: load, LCP и таймеры двигает тест.
describe("старт предзагрузки после отрисовки меню", () => {
  type Listener = (list: unknown) => void;
  let lcp: Listener | null;
  let loaded: (() => void) | null;
  let readyState: string;
  let supported: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    lcp = null;
    loaded = null;
    readyState = "loading";
    supported = ["largest-contentful-paint"];
    vi.stubGlobal("document", {
      get readyState() {
        return readyState;
      },
    });
    vi.stubGlobal("window", {
      addEventListener: (type: string, listener: () => void) => {
        if (type === "load") loaded = listener;
      },
      removeEventListener: () => {
        loaded = null;
      },
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
      clearTimeout: (id: number) => clearTimeout(id),
      requestIdleCallback: vi.fn(() => {
        throw new Error("старт не должен ждать простоя");
      }),
    });
    class Observer {
      static get supportedEntryTypes() {
        return supported;
      }
      constructor(listener: Listener) {
        lcp = listener;
      }
      observe() {}
      disconnect() {
        lcp = null;
      }
    }
    vi.stubGlobal("PerformanceObserver", Observer);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function load() {
    readyState = "complete";
    loaded?.();
  }

  it("load, LCP — и ровно через 1 с файлы пошли", async () => {
    const run = vi.fn();
    afterMenuShown(run);
    load();
    await vi.advanceTimersByTimeAsync(500);
    expect(run).not.toHaveBeenCalled();
    lcp?.({});
    await vi.advanceTimersByTimeAsync(START_DELAY - 1);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("LCP пришла несколькими записями — старт всё равно один", async () => {
    const run = vi.fn();
    afterMenuShown(run);
    load();
    const listener = lcp;
    listener?.({});
    listener?.({});
    await vi.advanceTimersByTimeAsync(10_000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("браузер не знает LCP (Safari) — через 1 с после load", async () => {
    supported = [];
    const run = vi.fn();
    afterMenuShown(run);
    load();
    await vi.advanceTimersByTimeAsync(START_DELAY);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("страница уже загружена к подключению — не ждём load", async () => {
    readyState = "complete";
    const run = vi.fn();
    afterMenuShown(run);
    lcp?.({});
    await vi.advanceTimersByTimeAsync(START_DELAY);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("отмена до старта — файлы не пошли", async () => {
    const run = vi.fn();
    const cancel = afterMenuShown(run);
    load();
    lcp?.({});
    cancel();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(run).not.toHaveBeenCalled();
  });
});
