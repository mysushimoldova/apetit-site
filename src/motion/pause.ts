// Паузы движка по причинам. Цикл кадров идёт, только когда причин нет.
//
// Отдельный модуль (а не часть engine.ts) по двум причинам: его можно
// проверить обычным тестом без браузера, и компоненты сайта (лист блюда,
// корзина, чипы) ставят паузу, не притягивая в свой бандл весь WebGL —
// здесь несколько строк.
//
// Причина — любая строка: 'hidden', 'sheet', 'cart', 'scroll', 'hero'…
// Считаем каждую причину, а не просто храним: один и тот же лист может
// смонтироваться дважды (React в разработке), и «resume» первого не должен
// снимать паузу второго.

const counts = new Map<string, number>();
const listeners = new Set<(paused: boolean) => void>();
let paused = false;

function sync() {
  const now = counts.size > 0;
  if (now === paused) return;
  paused = now;
  for (const listener of listeners) listener(paused);
}

/** Поставить движок на паузу по причине. */
export function pauseMotion(reason: string): void {
  counts.set(reason, (counts.get(reason) ?? 0) + 1);
  sync();
}

/** Снять свою паузу. Лишние вызовы безвредны. */
export function resumeMotion(reason: string): void {
  const left = (counts.get(reason) ?? 0) - 1;
  if (left > 0) counts.set(reason, left);
  else counts.delete(reason);
  sync();
}

/** Есть ли хоть одна причина стоять. */
export function isMotionPaused(): boolean {
  return paused;
}

/** Причины по алфавиту — для панели разработчика и тестов. */
export function motionPauseReasons(): string[] {
  return [...counts.keys()].sort();
}

/** Подписка на «встал / поехал». Возвращает отписку. */
export function onMotionPauseChange(
  listener: (paused: boolean) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Сброс — только для тестов. */
export function resetMotionPauses(): void {
  counts.clear();
  sync();
}
