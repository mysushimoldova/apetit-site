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
const IDLE_TIMEOUT = 4000;

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
