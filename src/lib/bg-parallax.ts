// Сдвиг фонового слоя линий (DESIGN.md → Background): слой едет вверх на
// 0.35 от прокрутки. Картинка — плитка, повторяющаяся без шва, поэтому
// через каждую высоту плитки сдвиг начинается заново.

/** Во сколько раз фон медленнее прокрутки. */
export const BG_PARALLAX = 0.35;

/** Высота плитки в ширинах кадра: два кадра 16:9 друг под другом
 *  (public/img/bg/linii.webp — 3200×1800, кадр 1600 шириной). */
export const BG_TILE_HEIGHT_PER_FRAME = 1.125;

/** Высота плитки на экране, px, по ширине кадра --bg-frame-w. */
export function bgTileHeight(frameWidth: number): number {
  return frameWidth > 0 ? frameWidth * BG_TILE_HEIGHT_PER_FRAME : 0;
}

/**
 * Сдвиг слоя по вертикали в px (всегда ≤ 0).
 * @param scrollY прокрутка страницы, px
 * @param period  высота плитки на экране, px (0 — ещё не измерено)
 */
export function bgOffset(scrollY: number, period: number): number {
  if (!(period > 0) || !(scrollY > 0)) return 0;
  // «+ 0» превращает -0 в 0 — в стиле будет translate3d(0, 0px, 0)
  return -((scrollY * BG_PARALLAX) % period) + 0;
}
