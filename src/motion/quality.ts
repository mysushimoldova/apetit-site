// Уровни качества движка. Чем слабее телефон, тем ниже уровень:
//
//   1 — плотность пикселей до 1.5, 60 кадров/с   (по умолчанию)
//   2 — плотность 1.0, 60 кадров/с
//   3 — плотность 1.0, 30 кадров/с
//   4 — стоп: один кадр и цикл выключен
//
// Первые две секунды после запуска движок меряет кадры окнами по секунде:
// меньше 50 — уровень ниже, ещё раз меньше 50 — ещё ниже, меньше 40 — стоп.
// Выбранный уровень живёт в sessionStorage: на следующей странице сайта
// слабый телефон не будет заново «проваливаться» с полного качества.

export type QualityLevel = 1 | 2 | 3 | 4;

/** Потолок плотности пикселей по уровню. */
export const MAX_DPR: Record<QualityLevel, number> = {
  1: 1.5,
  2: 1,
  3: 1,
  4: 1,
};

/** Наименьший промежуток между кадрами, мс (0 — каждый кадр экрана). */
export const MIN_FRAME_MS: Record<QualityLevel, number> = {
  1: 0,
  2: 0,
  3: 1000 / 30,
  4: Number.POSITIVE_INFINITY,
};

/** Плотность пикселей холста для уровня (экранная, но не ниже 1). */
export function canvasDpr(level: QualityLevel, deviceDpr: number): number {
  const dpr = deviceDpr > 0 ? deviceDpr : 1;
  return Math.min(Math.max(dpr, 1), MAX_DPR[level]);
}

/** Окно измерения кадров, мс, и сколько окон меряем после запуска. */
export const MEASURE_WINDOW_MS = 1000;
export const MEASURE_WINDOWS = 2;

/** Ниже этого — стоп; ниже следующего — на уровень ниже. */
export const FPS_STOP = 40;
export const FPS_DOWN = 50;

/** Уровень после окна измерения: только вниз, никогда вверх. */
export function nextQuality(level: QualityLevel, fps: number): QualityLevel {
  if (fps < FPS_STOP) return 4;
  if (fps < FPS_DOWN) return Math.min(4, level + 1) as QualityLevel;
  return level;
}

/** Меряем только там, где цель — 60 кадров. На уровне 3 кадров ровно 30,
 *  и измерение само себя загнало бы в «стоп». */
export function shouldMeasure(level: QualityLevel): boolean {
  return level <= 2;
}

export const QUALITY_KEY = "apetit.motion.quality";

function isLevel(value: unknown): value is QualityLevel {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

/** Уровень из sessionStorage. Недоступное хранилище (режим инкогнито
 *  в Safari) — не ошибка, просто начинаем с первого уровня. */
export function readQuality(storage: Storage | null | undefined): QualityLevel {
  try {
    const value = Number(storage?.getItem(QUALITY_KEY));
    return isLevel(value) ? value : 1;
  } catch {
    return 1;
  }
}

export function writeQuality(
  storage: Storage | null | undefined,
  level: QualityLevel,
): void {
  try {
    storage?.setItem(QUALITY_KEY, String(level));
  } catch {
    // Хранилище закрыто настройками — уровень просто не запомнится
  }
}
