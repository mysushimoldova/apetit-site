// Ожидания заставки: «не дольше стольких-то миллисекунд», «меню уже
// отрисовано» и очередь файлов предзагрузки. Отдельный модуль — всё это
// проверяет тест (wait.test.ts).

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

/** Пауза после отрисовки меню до первого файла предзагрузки, мс (решение
 *  архитектора 25.09.2026, B0). */
export const START_DELAY = 1000;

/**
 * Вызвать run через START_DELAY после того, как страница загрузилась (load)
 * и меню отрисовано (LCP). Простоя страницы НЕ ждём: линии фона рисуются
 * каждый кадр, и простоев почти нет (замер 25.09.2026 — ни одного куска
 * ≥ 1 мс за 3 с), а в Safari requestIdleCallback нет вовсе. Раньше из-за
 * этого на iPhone ролики не успевали скачаться, и заставки не было.
 * Браузер не знает LCP (Safari) — отсчёт от load. Возвращает отмену.
 */
export function afterMenuShown(run: () => void): () => void {
  let cancelled = false;
  let timer = 0;
  let observer: PerformanceObserver | null = null;
  /** Старт уже назначен: LCP может прийти не одной записью, а запасной
   *  таймер — после неё. */
  let scheduled = false;

  const schedule = () => {
    if (cancelled || scheduled) return;
    scheduled = true;
    observer?.disconnect();
    observer = null;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!cancelled) run();
    }, START_DELAY);
  };

  const afterLoad = () => {
    if (cancelled) return;
    const types = PerformanceObserver.supportedEntryTypes ?? [];
    if (!types.includes("largest-contentful-paint")) {
      schedule();
      return;
    }
    // buffered: запись о LCP, случившейся до подписки, придёт сразу
    observer = new PerformanceObserver(schedule);
    observer.observe({ type: "largest-contentful-paint", buffered: true });
    timer = window.setTimeout(schedule, LCP_WAIT);
  };

  if (document.readyState === "complete") afterLoad();
  else window.addEventListener("load", afterLoad, { once: true });

  return () => {
    cancelled = true;
    window.removeEventListener("load", afterLoad);
    observer?.disconnect();
    window.clearTimeout(timer);
  };
}

/**
 * Скачать файлы по очереди, по одному: следующий начинается, как только
 * закончился предыдущий (скачан или упал), — без пауз и без ожидания
 * простоя. Первый — таймером, не внутри чужого обработчика. Сколько
 * сети берёт каждый файл, решает его fetch с priority "low", а не очередь.
 * Упавшая задача очередь не останавливает. Возвращает отмену.
 */
export function fileQueue(
  tasks: ReadonlyArray<() => Promise<unknown>>,
): () => void {
  let cancelled = false;
  let next = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = () => {
    timer = undefined;
    if (cancelled || next >= tasks.length) return;
    const task = tasks[next++];
    void task()
      .catch(() => {})
      .then(run);
  };

  timer = setTimeout(run, 0);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
