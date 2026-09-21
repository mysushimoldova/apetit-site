// Общее сглаженное значение прокрутки для всех слоёв движка.
//
// Каждый кадр значение подтягивается к настоящей прокрутке:
//   k = 1 − (1 − ease) ^ (dt / 16.67)
//   smooth += (target − smooth) × k
// Степень с dt делает инертность одинаковой при 60 и 30 кадрах в секунду:
// за два кадра по 16.67 мс приближение то же, что за один кадр 33.3 мс.
//
// Слои получают frame.scroll = smooth и сами умножают на свой parallax.

/** Кадр при 60 к/с, мс — к нему приведена инертность. */
export const SCROLL_FRAME_MS = 16.67;

/**
 * Доля пути к цели за этот кадр.
 * @param ease инертность 0…1 (0 — стоит на месте, 1 — сразу в цель)
 * @param dt   время кадра, мс
 */
export function smoothingFactor(ease: number, dt: number): number {
  if (!(ease > 0) || !(dt > 0)) return 0;
  if (ease >= 1) return 1;
  return 1 - Math.pow(1 - ease, dt / SCROLL_FRAME_MS);
}

/** Новое сглаженное значение. */
export function stepScroll(
  smooth: number,
  target: number,
  ease: number,
  dt: number,
): number {
  return smooth + (target - smooth) * smoothingFactor(ease, dt);
}

/** Сглаженная прокрутка: состояние + шаг на кадр. Без обращений к браузеру —
 *  цель приходит снаружи, поэтому это проверяется обычным тестом. */
export class ScrollSmoother {
  private smooth = 0;
  constructor(private ease: number) {}

  /** Текущее сглаженное значение. */
  get value(): number {
    return this.smooth;
  }

  setEase(ease: number): void {
    this.ease = ease;
  }

  /** Шаг кадра: подтянуть значение к target за dt мс. */
  update(target: number, dt: number): number {
    this.smooth = stepScroll(this.smooth, target, this.ease, dt);
    return this.smooth;
  }

  /** Встать ровно в target — после паузы, чтобы фон не «догонял» издалека. */
  reset(target: number): void {
    this.smooth = target;
  }
}
