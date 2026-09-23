// «Aterizare» — физика подъёма фото при прокрутке. Чистые функции без
// браузера: слой (src/motion/layers/products.ts) только раздаёт результат
// по элементам, а считается всё здесь — и поэтому проверяется обычным тестом.
//
// Формулы ровно те же, что в эталонном демо docs/motion/produse-demo.html
// (функция loop, ветка efect = "land"):
//
//   1. Прокрутку сглаживаем: k = 1 − (1 − smooth)^(dt/16.67).
//   2. Скорость — сколько сглаженная прокрутка прошла за кадр, px, сама
//      сглаженная смешиванием 0.3 (иначе дрожит на каждом кадре).
//   3. Цель подъёма: 1 − exp(−|скорость| / sensitivity) — растёт быстро и
//      упирается в 1, как бы быстро ни листали.
//   4. Пружина к этой цели: вверх жёсткая (320), вниз мягкая (settle) —
//      поэтому фото взлетает сразу, а садится спокойно. Затухание
//      критическое (2·√жёсткости), поэтому не качается около нуля.
import { smoothingFactor, SCROLL_FRAME_MS } from "./scroll";
import type {
  ProductLiftSettings,
  ProductShadowSettings,
} from "./config-schema";

/** Жёсткость пружины на подъёме. Вниз жёсткость берётся из настроек
 *  (settle) — она меньше, поэтому приземление медленнее взлёта. */
export const LIFT_RISE_STIFF = 320;

/** Насколько скорость подмешивается к прошлой: 1 — без сглаживания. */
export const LIFT_VEL_BLEND = 0.3;

/** Потолок подъёма: пружина может немного перелететь цель, но не вдвое. */
export const LIFT_MAX = 1.2;

/** Ниже этих значений считаем, что всё успокоилось и пора снимать стили.
 *  Порог не микроскопический нарочно (docs/MOTION.md §5: покой не позже
 *  400 мс после остановки): при подъёме 0.01 фото сдвинуто на 0.07 пикселя —
 *  этого не видно, а ждать полного нуля пружина будет ещё секунду. */
export const LIFT_STILL = 0.01;
export const VEL_STILL = 0.2;

export interface LiftState {
  /** Сглаженная прокрутка, px. */
  scroll: number;
  /** Сглаженная скорость, px за кадр 60 к/с. */
  vel: number;
  /** Подъём 0…1.2. */
  lift: number;
  /** Скорость подъёма, 1/с. */
  liftV: number;
}

/** Покой: ничего не поднято, ничего не едет. */
export function restLift(scroll = 0): LiftState {
  return { scroll, vel: 0, lift: 0, liftV: 0 };
}

/** Куда тянется подъём при такой скорости. */
export function liftTarget(vel: number, sensitivity: number): number {
  if (!(sensitivity > 0)) return 0;
  return 1 - Math.exp(-Math.abs(vel) / sensitivity);
}

/**
 * Шаг кадра.
 * @param state   прошлое состояние
 * @param scrollY настоящая прокрутка страницы, px
 * @param dt      время кадра, мс
 */
export function stepLift(
  state: LiftState,
  scrollY: number,
  dt: number,
  settings: Pick<ProductLiftSettings, "smooth" | "sensitivity" | "settle">,
): LiftState {
  if (!(dt > 0)) return restLift(scrollY);
  const k = smoothingFactor(settings.smooth, dt);
  const scroll = state.scroll + (scrollY - state.scroll) * k;
  const perFrame =
    ((scroll - state.scroll) / Math.max(1, dt)) * SCROLL_FRAME_MS;
  const vel = state.vel + (perFrame - state.vel) * LIFT_VEL_BLEND;

  const target = liftTarget(vel, settings.sensitivity);
  const stiff = target > state.lift ? LIFT_RISE_STIFF : settings.settle;
  const damp = 2 * Math.sqrt(stiff);
  const seconds = dt / 1000;
  const liftV =
    state.liftV +
    (stiff * (target - state.lift) - damp * state.liftV) * seconds;
  const lift = Math.min(LIFT_MAX, Math.max(0, state.lift + liftV * seconds));
  return { scroll, vel, lift, liftV };
}

/** Всё успокоилось: скорости нет, фото на месте. Про саму прокрутку тут
 *  ничего не спрашиваем: сглаженное значение подбирается к настоящему
 *  бесконечно долго, и слой ещё секунду держал бы will-change впустую.
 *  На вид разницы нет — при такой скорости подъём меньше сотой пикселя. */
export function liftAtRest(state: LiftState): boolean {
  return (
    Math.abs(state.vel) < VEL_STILL &&
    state.lift < LIFT_STILL &&
    Math.abs(state.liftV) < LIFT_STILL
  );
}

/** Что написать элементам карточки на этом кадре. */
export interface LiftFrame {
  /** transform блока с фото. */
  photo: string;
  /** transform группы теней. */
  shadow: string;
  /** Прозрачность широкой тени. */
  ambient: number;
  /** Прозрачность контактной тени. */
  contact: number;
}

/** Подъём в значениях для DOM. Только transform и opacity — раскладка не
 *  трогается, поэтому страница не дёргается (CLS = 0). */
export function liftFrame(
  state: LiftState,
  settings: ProductLiftSettings,
  shadow: Pick<ProductShadowSettings, "aa" | "ca">,
): LiftFrame {
  const { lift } = state;
  const a = settings.amt;
  const h = settings.shadowReact;
  const rise = -lift * settings.rise * a;
  const scale = 1 + (lift * settings.grow * a) / 100;
  const tilt = -Math.sign(state.vel) * lift * settings.tilt * a;
  return {
    photo: `translate3d(0, ${rise.toFixed(2)}px, 0) scale(${scale.toFixed(4)}) rotateX(${tilt.toFixed(2)}deg)`,
    shadow: `translate3d(0, ${(lift * 3 * h).toFixed(2)}px, 0) scaleX(${(1 + lift * 0.16 * h).toFixed(3)})`,
    ambient: shadow.aa * (1 + lift * 0.4 * h),
    contact: shadow.ca * Math.max(0, 1 - lift * 0.9 * h),
  };
}
