// Размер блюда на заставке и скорость ролика — те же формулы, что в эталоне
// docs/motion/splash-demo.html (функции layout() и keyFrame()).
// Чистые числа, без DOM: так их можно проверить обычным тестом.

/** Дальше этой ширины блюдо не растёт даже на большом экране, px. */
export const MAX_VIDEO_WIDTH = 320;

/** Доля высоты экрана, в которую блюдо обязано поместиться целиком. */
export const HEIGHT_SHARE = 0.6;

/** Разгон и замедление вшиты в сам ролик (1.5 с) — длительность заставки
 *  только растягивает или сжимает его. */
export const VIDEO_MS = 1500;

/** Быстрее вдвое и медленнее вдвое — дальше ролик выглядит неестественно. */
export const RATE_RANGE = [0.5, 2] as const;

/** Скорость ролика при заданной длительности заставки. */
export function splashRate(holdMs: number): number {
  if (!Number.isFinite(holdMs) || holdMs <= 0) return RATE_RANGE[1];
  return Math.max(RATE_RANGE[0], Math.min(RATE_RANGE[1], VIDEO_MS / holdMs));
}

export interface VideoFit {
  /** Ширина области заставки, px. */
  stageWidth: number;
  /** Высота области заставки, px. */
  stageHeight: number;
  /** Ширина кадра, делённая на его ВИДИМУЮ высоту (половину файла). */
  aspect: number;
  /** Доля ширины экрана под блюдо (настройка zoom). */
  zoom: number;
}

/**
 * Ширина блюда на экране. Три ограничения сразу: доля ширины экрана,
 * доля высоты (с учётом пропорций кадра) и предел в пикселях. Поэтому
 * вертикальная бутылка и горизонтальный сэндвич выходят одинаково
 * крупными, а не «бутылка во весь экран».
 */
export function splashVideoWidth(fit: VideoFit): number {
  const { stageWidth, stageHeight, aspect, zoom } = fit;
  if (!(aspect > 0) || stageWidth <= 0 || stageHeight <= 0) return 0;
  return Math.min(
    Math.max(0, zoom) * stageWidth,
    HEIGHT_SHARE * stageHeight * aspect,
    MAX_VIDEO_WIDTH,
  );
}

/**
 * Когда переключаться на следующее блюдо, мс от начала заставки.
 * Одно блюдо — переключений нет; два — второе приходит на середине.
 */
export function splashSwitchTimes(holdMs: number, videos: number): number[] {
  const n = Math.max(1, videos);
  const times: number[] = [];
  for (let i = 1; i < n; i++) times.push(Math.round((holdMs * i) / n));
  return times;
}
