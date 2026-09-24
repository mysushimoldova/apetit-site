// Что происходит с заставкой в каждый момент времени: размер и высота
// блюда, диаметр жёлтого круга, прозрачность. Здесь нет ни DOM, ни WebGL —
// только время и кривые, поэтому всё проверяется обычным тестом.
//
// Эталон — docs/motion/splash-demo.html (шапка файла и объект S): ролик
// просто играет, а поверх него каждый кадр считаются размер, высота и круг.
//
//   p        = время от начала заставки / hold
//   ease(p)  — кривая хозяина (start, soft), та же, что вшита в ролик
//   размер   z = z0 + (z1 − z0)·ease(p)
//   высота   y = y0 + (y1 − y0)·ease(p)
//   круг     d = d0 + (d1 − d0)·easeD(q),  q = max(0, (p − delay)/(1 − delay))
//
// Появление (fin) и уход (fout) идут по кривым сайта — docs/MOTION.md §3.
import { easeIn, easeOut, mix, progress, splashEase } from "./easing";

export type SplashExit = "lift" | "fade" | "zoom";

/** Движение блюда: размер и высота от начала к концу по своей кривой. */
export interface SplashDishTiming {
  /** Размер в начале и в конце (множитель к размеру, вписанному в экран). */
  z0: number;
  z1: number;
  /** Высота в начале и в конце, px вниз по экрану. */
  y0: number;
  y1: number;
  /** Плавный старт и замедление к концу. */
  start: number;
  soft: number;
}

/** Движение жёлтого круга: свой размер, своя кривая, своя задержка. */
export interface SplashDiscTiming {
  /** Диаметр в начале и в конце, доля ширины экрана. */
  d0: number;
  d1: number;
  /** Плавный старт и замедление к концу — у круга свои. */
  dstart: number;
  dsoft: number;
  /** Круг трогается позже блюда: доля времени заставки (0.2 — на пятой части). */
  delay: number;
  /** Круг выше (−) или ниже (+) середины экрана, px. */
  y: number;
}

/** Всё, от чего зависит картинка заставки в данный момент. */
export interface SplashTiming {
  /** Сколько заставка держится до ухода, мс. */
  hold: number;
  /** Появление по прозрачности, мс. */
  fin: number;
  /** Уход, мс. */
  fout: number;
  exit: SplashExit;
  dish: SplashDishTiming;
  disc: SplashDiscTiming;
}

/** Сколько всего живёт заставка от нажатия до полного ухода, мс. */
export function totalMs(hold: number, fout: number): number {
  return hold + fout;
}

/** Уход «в меню»: куда и во сколько раз уезжает блюдо (эталон, endSplash). */
const ZOOM_SCALE = 0.3;
const ZOOM_X = -0.22;
const ZOOM_Y = 0.42;
/** Уход «в меню»: во сколько раз сжимается круг. */
const ZOOM_DISC = 0.05;

export interface SplashVisual {
  /** Размер блюда: множитель к размеру, вписанному в экран. */
  dishScale: number;
  /** Высота блюда, px вниз по экрану. */
  dishY: number;
  /** Диаметр жёлтого круга, доля ширины экрана. */
  disc: number;
  /** Высота круга, px вниз по экрану. */
  discY: number;
  /** Прозрачность круга, блюда и слова (появление и уход). */
  alpha: number;
  /** Прозрачность кремового экрана: гаснет только при уходе затуханием. */
  screenAlpha: number;
  /** Сдвиг всей заставки вверх, доля высоты экрана (уход «шторкой»). */
  liftShare: number;
  /** Сдвиг блюда при уходе «в меню», доли ширины и высоты экрана. */
  zoomX: number;
  zoomY: number;
  /** Заставка ещё видна? false — слой может не рисовать вовсе. */
  visible: boolean;
}

/**
 * Картинка заставки на момент elapsed (мс от нажатия на категорию).
 *
 * exitStart — когда начинается уход: обычно это hold, но если заставку
 * прервали касанием, то момент касания. Движение блюда и круга на этом
 * моменте замирает — ролик в эту же секунду ставится на паузу.
 */
export function splashVisual(
  elapsed: number,
  settings: SplashTiming,
  exitStart = settings.hold,
): SplashVisual {
  const { dish, disc } = settings;

  // Блюдо и круг: до ухода едут, с начала ухода стоят
  const p = progress(Math.min(elapsed, exitStart), settings.hold);
  const e = splashEase(p, dish.start, dish.soft);
  const delay = Math.min(1, Math.max(0, disc.delay));
  const q = delay >= 1 ? 1 : progress(p - delay, 1 - delay);
  const d = splashEase(q, disc.dstart, disc.dsoft);

  const base: SplashVisual = {
    dishScale: mix(dish.z0, dish.z1, e),
    dishY: mix(dish.y0, dish.y1, e),
    disc: mix(disc.d0, disc.d1, d),
    discY: disc.y,
    // Круг, блюдо и слово появляются по прозрачности. Кривая входа набирает
    // быстро: к 50 мс из 400 видно уже около половины — пустого кремового
    // экрана в начале заставки не бывает (решение архитектора 24.09.2026).
    alpha: easeIn(progress(elapsed, settings.fin)),
    screenAlpha: 1,
    liftShare: 0,
    zoomX: 0,
    zoomY: 0,
    visible: true,
  };

  if (elapsed < exitStart) return base;

  // Уход — по кривой ухода сайта (docs/MOTION.md §3): трогается сразу и
  // мягко замирает в конце.
  const k = easeOut(progress(elapsed - exitStart, settings.fout));
  if (k >= 1) {
    return { ...base, alpha: 0, screenAlpha: 0, visible: false };
  }
  if (settings.exit === "lift") {
    return { ...base, liftShare: k };
  }
  if (settings.exit === "zoom") {
    return {
      ...base,
      dishScale: base.dishScale * mix(1, ZOOM_SCALE, k),
      disc: base.disc * mix(1, ZOOM_DISC, k),
      zoomX: mix(0, ZOOM_X, k),
      zoomY: mix(0, ZOOM_Y, k),
      alpha: base.alpha * (1 - k),
    };
  }
  // Затухание: гаснет вся заставка целиком, ничего не двигаясь
  return { ...base, alpha: base.alpha * (1 - k), screenAlpha: 1 - k };
}
