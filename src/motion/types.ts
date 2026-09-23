// Общие типы движка анимаций (src/motion/engine.ts).
// Движок один на сайт: один <canvas>, один контекст WebGL, один цикл кадров.
// Эффекты подключаются к нему слоями — у каждого слоя свои буферы и шейдеры.
import type { QualityLevel } from "./quality";

/** Контекст WebGL2 или запасной WebGL1 (с OES_standard_derivatives). */
export type GL = WebGL2RenderingContext | WebGLRenderingContext;

/** Всё, что слой знает о текущем кадре. */
export interface Frame {
  /** Время с первого кадра, СЕКУНДЫ (uT шейдеров). При «уменьшить движение» — 0. */
  t: number;
  /** Время с прошлого кадра, МИЛЛИСЕКУНДЫ (для сглаживания прокрутки). */
  dt: number;
  /** Ширина холста в CSS-пикселях. */
  width: number;
  /** Высота холста в CSS-пикселях. */
  height: number;
  /** Пикселей экрана на CSS-пиксель: настоящая плотность экрана, до тройной.
   *  От уровня качества НЕ зависит (src/motion/quality.ts). */
  dpr: number;
  /** Сглаженная прокрутка страницы, px (src/motion/scroll.ts). Слой сам
   *  умножает её на свой parallax. При «уменьшить движение» — 0. */
  scroll: number;
  /** Настоящая прокрутка окна, px, без сглаживания. Нужна слоям, у которых
   *  своя инертность (карточки блюд сглаживают её по-своему, иначе ползунок
   *  «плавность» в /dev/motion менял бы заодно и фон). */
  scrollY: number;
  /** Уровень качества движка (1…4): слой сам решает, чем упроститься.
   *  Фон берёт отсюда число волн в поле (src/motion/quality.ts). */
  quality: QualityLevel;
}

/**
 * Слой эффекта. Владеет своими ресурсами GL: создаёт их в init,
 * рисует в render, освобождает в dispose. Движок вызывает эти методы
 * и больше ничего о слое не знает.
 */
export interface Layer {
  /** Уникальное имя: engine.remove(id). */
  readonly id: string;
  /** Порядок рисования: меньше — раньше (ниже). */
  readonly zIndex: number;
  init(gl: GL): void;
  render(gl: GL, frame: Frame): void;
  dispose(gl: GL): void;
}
