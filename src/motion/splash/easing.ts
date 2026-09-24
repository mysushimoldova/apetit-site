// Кривые движения числами. В CSS их задают одной строкой, но заставку
// рисует WebGL: кадр считает слой, и кривая нужна как функция.
//
// Кривые — те, что в docs/MOTION.md §3, третьей на сайте нет:
//   вход/появление — cubic-bezier(.22, 1, .36, 1)
//   уход/закрытие  — cubic-bezier(.32, .72, 0, 1)

/**
 * Значение кривой cubic-bezier(x1, y1, x2, y2) в точке t (0…1).
 *
 * По x решаем уравнение методом деления отрезка пополам: 24 шага дают
 * точность порядка 1e-7 — глазу этого более чем достаточно, а считается
 * это раз в кадр для двух-трёх величин.
 */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (t: number) => number {
  const curve = (a: number, b: number, t: number) => {
    const u = 1 - t;
    return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
  };
  return (t: number) => {
    if (!(t > 0)) return 0;
    if (t >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let mid = t;
    for (let i = 0; i < 24; i++) {
      mid = (lo + hi) / 2;
      if (curve(x1, x2, mid) < t) lo = mid;
      else hi = mid;
    }
    return curve(y1, y2, mid);
  };
}

/** Появление, подъём (docs/MOTION.md §3). */
export const easeIn = cubicBezier(0.22, 1, 0.36, 1);

/** Уход, перемещение, закрытие (docs/MOTION.md §3). Трогается сразу:
 *  кривая с медленным стартом читается как залипание. */
export const easeOut = cubicBezier(0.32, 0.72, 0, 1);

/** Доля пройденного времени, 0…1. Нулевая длительность — сразу 1. */
export function progress(elapsedMs: number, durationMs: number): number {
  if (!(durationMs > 0)) return 1;
  return Math.max(0, Math.min(1, elapsedMs / durationMs));
}

export function mix(from: number, to: number, k: number): number {
  return from + (to - from) * k;
}
