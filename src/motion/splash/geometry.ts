// Размер блюда на заставке и скорость ролика — те же формулы, что в эталоне
// docs/motion/splash-demo.html (функция layout() и playbackRate в шапке).
// Чистые числа, без DOM: так их можно проверить обычным тестом.

/** Доля ширины экрана, в которую блюдо вписывается при размере 1 (эталон:
 *  baseW = min(0.9 × ширина, 0.6 × высота × пропорции)). Дальше блюдо
 *  умножается на размер из настроек: 1.32 в начале, 0.96 в конце. */
export const WIDTH_SHARE = 0.9;

/** Доля высоты экрана, в которую блюдо обязано поместиться целиком.
 *  Из-за неё вертикальная бутылка и горизонтальный сэндвич выходят
 *  одинаково крупными, а не «бутылка во весь экран». */
export const HEIGHT_SHARE = 0.6;

/** Длина ролика заставки: 60 кадров при 60 к/с — ровно секунда.
 *  Кривая поворота вшита в файл (scripts/splash-video/make.py), поэтому на
 *  сайте ролик просто играет от начала до конца. */
export const VIDEO_MS = 1000;

/** Скорость ролика при заданной длительности заставки: при hold = 1000
 *  обычная, короче — быстрее, длиннее — медленнее. Никаких перемоток и
 *  подгонки скорости по ходу: разгон и замедление уже внутри файла. */
export function splashRate(holdMs: number): number {
  if (!Number.isFinite(holdMs) || holdMs <= 0) return 1;
  return VIDEO_MS / holdMs;
}

export interface DishFit {
  /** Ширина области заставки, px. */
  stageWidth: number;
  /** Высота области заставки, px. */
  stageHeight: number;
  /** Ширина кадра, делённая на его ВИДИМУЮ высоту (половину файла). */
  aspect: number;
}

/**
 * Ширина блюда на экране при размере 1: вписать по ширине и по высоте с
 * учётом пропорций кадра. Размер из настроек (z0 → z1) умножается сверху.
 */
export function splashDishWidth(fit: DishFit): number {
  const { stageWidth, stageHeight, aspect } = fit;
  if (!(aspect > 0) || stageWidth <= 0 || stageHeight <= 0) return 0;
  return Math.min(
    WIDTH_SHARE * stageWidth,
    HEIGHT_SHARE * stageHeight * aspect,
  );
}
