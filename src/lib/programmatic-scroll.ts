// Ожидание конца программной прокрутки (клик по чипу → scrollIntoView).
// Конец — событие scrollend или, где его нет (старый Safari), пауза без
// событий scroll. Если человек сам вмешался (колесо, касание, клавиша) —
// конец сразу, с пометкой interrupted.

/** Пауза без scroll, после которой прокрутка считается законченной. */
export const SCROLL_IDLE_MS = 150;

/** Сколько ждать первого scroll: если секция уже на месте, его не будет.
 *  Дольше паузы — первый scroll может запоздать, пока браузер занят
 *  (например, расшифровывает картинку фона), и фиксация снялась бы раньше. */
export const SCROLL_START_MS = 1000;

const INTERRUPT_EVENTS = ["wheel", "touchstart", "pointerdown", "keydown"];

/**
 * Следит за прокруткой target (window) и один раз вызывает onEnd.
 * Возвращает отмену (без вызова onEnd) — для нового клика и размонтирования.
 */
export function watchProgrammaticScroll(
  target: EventTarget,
  onEnd: (interrupted: boolean) => void,
  idleMs: number = SCROLL_IDLE_MS,
  startMs: number = SCROLL_START_MS,
): () => void {
  let done = false;
  let idle = setTimeout(() => finish(false), startMs);

  const onScroll = () => {
    clearTimeout(idle);
    idle = setTimeout(() => finish(false), idleMs);
  };
  const onScrollEnd = () => finish(false);
  const onInterrupt = () => finish(true);

  target.addEventListener("scroll", onScroll, { passive: true });
  target.addEventListener("scrollend", onScrollEnd);
  // Вмешательство слушаем со следующего цикла: нажатие, которое запустило
  // прокрутку (Space на чипе — это keydown), ещё всплывает до window
  const arm = setTimeout(() => {
    for (const type of INTERRUPT_EVENTS)
      target.addEventListener(type, onInterrupt, { passive: true });
  }, 0);

  function stop() {
    done = true;
    clearTimeout(idle);
    clearTimeout(arm);
    target.removeEventListener("scroll", onScroll);
    target.removeEventListener("scrollend", onScrollEnd);
    for (const type of INTERRUPT_EVENTS)
      target.removeEventListener(type, onInterrupt);
  }

  function finish(interrupted: boolean) {
    if (done) return;
    stop();
    onEnd(interrupted);
  }

  return stop;
}
