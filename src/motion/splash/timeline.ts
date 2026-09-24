// Что происходит с заставкой в каждый момент времени: числа для слоя
// (жёлтый круг, блюдо) и для оверлея (слово, фон). Здесь нет ни DOM, ни
// WebGL — только время и кривые, поэтому всё проверяется обычным тестом.
//
// Поведение взято из эталона docs/motion/splash-demo.html (playSplash /
// endSplash), но кривые — наши, из docs/MOTION.md §3: у эталона своя
// пружинистая, а закон движения сайта разрешает только две.
import { easeIn, mix, progress } from "./easing";

export type SplashExit = "lift" | "fade" | "zoom";

export interface SplashPhaseSettings {
  /** Появление, мс (настройка fade). */
  fade: number;
  exit: SplashExit;
}

/** Уход всегда чуть длиннее появления, но не короче этого, мс. */
export const MIN_EXIT_MS = 180;

/** Во сколько раз уход длиннее появления (эталон). */
export const EXIT_FACTOR = 1.6;

export function exitMs(fade: number): number {
  return Math.max(MIN_EXIT_MS, Math.round(fade * EXIT_FACTOR));
}

/** Сколько всего живёт заставка от нажатия до полного ухода, мс. */
export function totalMs(hold: number, fade: number): number {
  return hold + exitMs(fade);
}

export interface SplashVisual {
  /** Масштаб жёлтого круга и его непрозрачность. */
  discScale: number;
  discAlpha: number;
  /** Масштаб блюда и его непрозрачность. */
  foodScale: number;
  foodAlpha: number;
  /** Сдвиг всей заставки вверх, доля высоты экрана (уход «шторкой»). */
  liftShare: number;
  /** Сдвиг блюда к корзине меню при уходе «в меню», доли ширины/высоты. */
  zoomX: number;
  zoomY: number;
  /** Заставка ещё видна? false — слой может не рисовать вовсе. */
  visible: boolean;
}

/** На сколько пикселей фото поднимается за время показа (задание
 *  архитектора: «лёгкий сдвиг вверх на 4 px»). */
export const PHOTO_RISE_PX = 4;

/**
 * Движение фото на заставке за время показа: масштаб от zoomFrom до 1 и
 * подъём на PHOTO_RISE_PX. Кривая — та же, что вшита в ролики: быстро
 * вначале, медленно в конце (docs/MOTION.md §3, вход).
 *
 * Считается от начала заставки и не зависит от ухода: уезжает вся заставка
 * целиком, вместе с блюдом (см. liftShare в splashVisual).
 */
export function splashPhotoMotion(
  elapsed: number,
  hold: number,
  zoomFrom: number,
): { scale: number; risePx: number } {
  const k = easeIn(progress(elapsed, hold));
  return { scale: mix(zoomFrom, 1, k), risePx: mix(0, PHOTO_RISE_PX, k) };
}

const START_DISC = 0.55;
const START_FOOD = 0.9;

/** Круг въезжает дольше остальных: он крупный (эталон — fade × 1.5). */
const DISC_FACTOR = 1.5;
const FOOD_FACTOR = 1.25;

const IDLE: SplashVisual = {
  discScale: 1,
  discAlpha: 1,
  foodScale: 1,
  foodAlpha: 1,
  liftShare: 0,
  zoomX: 0,
  zoomY: 0,
  visible: true,
};

/**
 * Картинка заставки на момент elapsed (мс от нажатия на категорию).
 * hold — сколько заставка держится до ухода (настройка), дальше идёт уход.
 * ended — заставку прервали касанием: уход начинается с этого момента.
 */
export function splashVisual(
  elapsed: number,
  hold: number,
  settings: SplashPhaseSettings,
  exitStart = hold,
): SplashVisual {
  const fade = Math.max(0, settings.fade);
  const out = exitMs(fade);
  if (elapsed >= exitStart) {
    // Уход идёт по кривой ВХОДА (--ease-reveal): заставка большая, её уход
    // обязан трогаться сразу и мягко замирать в конце (решение архитектора
    // 24.09.2026; прежняя кривая ухода стартовала медленно, и из 320 мс
    // глазу было видно 120).
    const k = easeIn(progress(elapsed - exitStart, out));
    if (k >= 1) return { ...IDLE, discAlpha: 0, foodAlpha: 0, visible: false };
    if (settings.exit === "lift") {
      return { ...IDLE, liftShare: k };
    }
    if (settings.exit === "zoom") {
      return {
        ...IDLE,
        foodScale: mix(1, 0.34, k),
        zoomX: mix(0, -0.22, k),
        zoomY: mix(0, 0.42, k),
        foodAlpha: 1 - k,
        discScale: mix(1, 0.2, k),
        discAlpha: 1 - k,
      };
    }
    return { ...IDLE, discAlpha: 1 - k, foodAlpha: 1 - k };
  }

  // Круг и блюдо видны с ПЕРВОГО кадра: пустого кремового экрана в начале
  // заставки быть не должно (решение архитектора 24.09.2026). Появление
  // остаётся движением — круг и блюдо приходят в свой размер, — но
  // прозрачность больше не разгоняется с нуля, и блюдо не ждёт круга.
  // Ролик или фото к этому моменту уже загружены: если нет, заставка не
  // начинается вовсе (src/motion/splash/controller.ts).
  const disc = easeIn(progress(elapsed, fade * DISC_FACTOR));
  const food = easeIn(progress(elapsed, fade * FOOD_FACTOR));
  return {
    discScale: mix(START_DISC, 1, disc),
    discAlpha: 1,
    foodScale: mix(START_FOOD, 1, food),
    foodAlpha: 1,
    liftShare: 0,
    zoomX: 0,
    zoomY: 0,
    visible: true,
  };
}
