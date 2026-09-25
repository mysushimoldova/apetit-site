// Ожидания заставки: «не дольше стольких-то миллисекунд» и «страница уже
// показана и простаивает». Отдельный модуль — первое проверяет тест.

/** Результат promise, но не позже ms; не успел — fallback. */
export function waitUpTo<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    void promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/** Сколько ждать главную отрисовку (LCP) после load. Браузер её не
 *  сообщит вовсе, если вкладку открыли в фоне, — тогда не ждём дальше. */
const LCP_WAIT = 3000;

/** Потолок ожидания простоя: requestIdleCallback с timeout. */
export const IDLE_TIMEOUT = 4000;

/** Без requestIdleCallback (Safari) — просто пауза после load и LCP. */
const IDLE_FALLBACK = 1000;

/**
 * Вызвать run, когда страница загрузилась (load), главная отрисовка (LCP)
 * уже случилась и браузеру нечем заняться (requestIdleCallback). Так
 * фоновая работа гарантированно не попадает в первую загрузку и не
 * сдвигает LCP. Возвращает отмену.
 */
export function whenPageSettles(run: () => void): () => void {
  let cancelled = false;
  let idle = 0;
  let timer = 0;
  let observer: PerformanceObserver | null = null;
  /** Ожидание простоя уже поставлено: LCP может прийти не одной записью,
   *  а запасной таймер — после неё. */
  let settled = false;

  const onIdle = () => {
    if (!cancelled) run();
  };

  const idleThen = () => {
    observer?.disconnect();
    observer = null;
    clearTimeout(timer);
    if (cancelled || settled) return;
    settled = true;
    if (typeof window.requestIdleCallback === "function") {
      idle = window.requestIdleCallback(onIdle, { timeout: IDLE_TIMEOUT });
    } else {
      timer = window.setTimeout(onIdle, IDLE_FALLBACK);
    }
  };

  const afterLoad = () => {
    if (cancelled) return;
    const types = PerformanceObserver.supportedEntryTypes ?? [];
    if (!types.includes("largest-contentful-paint")) {
      idleThen();
      return;
    }
    // buffered: запись о LCP, случившейся до подписки, придёт сразу
    observer = new PerformanceObserver(idleThen);
    observer.observe({ type: "largest-contentful-paint", buffered: true });
    timer = window.setTimeout(idleThen, LCP_WAIT);
  };

  if (document.readyState === "complete") afterLoad();
  else window.addEventListener("load", afterLoad, { once: true });

  return () => {
    cancelled = true;
    window.removeEventListener("load", afterLoad);
    observer?.disconnect();
    clearTimeout(timer);
    if (idle && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(idle);
    }
  };
}

/** Меньше стольких миллисекунд простоя в куске — файл ждёт следующего.
 *  В куске только запуск скачивания (доли миллисекунды), а простои между
 *  кадрами, пока фон рисуется, бывают всего по 1–3 мс. */
const MIN_IDLE_MS = 1;

/**
 * Запустить задачи по одной: каждую — в своём куске простоя
 * (requestIdleCallback), и только если в куске есть хотя бы MIN_IDLE_MS.
 * Следующая задача ставится, когда предыдущая закончилась (файл скачан),
 * а не весь список за раз. Упавшая задача очередь не останавливает.
 * Если длинного простоя так и нет, задача всё равно идёт через IDLE_TIMEOUT
 * от первой просьбы — отсчёт не начинается заново с каждым коротким куском.
 * Без requestIdleCallback (Safari) — пауза IDLE_FALLBACK между задачами.
 * Возвращает отмену.
 */
export function idleQueue(
  tasks: ReadonlyArray<() => Promise<unknown>>,
): () => void {
  let cancelled = false;
  let next = 0;
  let idle = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Когда текущая задача впервые попросила простой. */
  let askedAt = 0;
  const hasIdle = typeof requestIdleCallback === "function";

  const run = (deadline?: IdleDeadline) => {
    idle = 0;
    timer = undefined;
    if (cancelled || next >= tasks.length) return;
    // Кусок почти кончился — ждём следующего, чтобы не залезть в кадр
    const waited = performance.now() - askedAt;
    if (
      deadline &&
      !deadline.didTimeout &&
      deadline.timeRemaining() < MIN_IDLE_MS &&
      waited < IDLE_TIMEOUT
    ) {
      ask(IDLE_TIMEOUT - waited);
      return;
    }
    const task = tasks[next++];
    void task()
      .catch(() => {})
      .then(() => {
        if (!cancelled) schedule();
      });
  };

  /** Попросить кусок простоя; timeout — сколько ещё осталось ждать. */
  function ask(timeout: number): void {
    if (hasIdle) idle = requestIdleCallback(run, { timeout });
    else timer = setTimeout(run, IDLE_FALLBACK);
  }

  /** Поставить следующую задачу: отсчёт ожидания — с этого момента. */
  function schedule(): void {
    if (cancelled || next >= tasks.length) return;
    askedAt = performance.now();
    ask(IDLE_TIMEOUT);
  }

  schedule();
  return () => {
    cancelled = true;
    if (idle && typeof cancelIdleCallback === "function")
      cancelIdleCallback(idle);
    clearTimeout(timer);
  };
}
