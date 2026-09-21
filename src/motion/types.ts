// Общие типы движка анимаций (src/motion/engine.ts).
// Движок один на сайт: один <canvas>, один контекст WebGL, один цикл кадров.
// Эффекты подключаются к нему слоями — у каждого слоя свои буферы и шейдеры.

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
  /** Пикселей экрана на CSS-пиксель (зависит от уровня качества). */
  dpr: number;
  /** Сглаженная прокрутка страницы, px (src/motion/scroll.ts). Слой сам
   *  умножает её на свой parallax. При «уменьшить движение» — 0. */
  scroll: number;
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
