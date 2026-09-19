// Сдвиг фонового слоя линий (DESIGN.md → Background): слой едет вверх на
// 0.35 от прокрутки. Картинка — три экрана подряд (обычный, зеркальный,
// обычный), поэтому через каждые два экрана сдвиг начинается заново без шва.

/** Во сколько раз фон медленнее прокрутки. */
export const BG_PARALLAX = 0.35;

/**
 * Сдвиг слоя по вертикали в px (всегда ≤ 0).
 * @param scrollY прокрутка страницы, px
 * @param period  высота двух экранов слоя, px (0 — ещё не измерено)
 */
export function bgOffset(scrollY: number, period: number): number {
  if (!(period > 0) || !(scrollY > 0)) return 0;
  // «+ 0» превращает -0 в 0 — в стиле будет translate3d(0, 0px, 0)
  return -((scrollY * BG_PARALLAX) % period) + 0;
}
