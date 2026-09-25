// Смах листа: быстро ли палец шёл вниз, когда его оторвали. Скорость — средняя
// за последние FLICK_WINDOW_MS движения, а не по двум последним точкам: на
// телефоне 120 Гц точки идут каждые 8 мс, и дрожание датчика на 1 px там само
// по себе даёт 0.125 px/мс — больше порога. По двум точкам спокойный смах
// срабатывал через раз, по окну — всегда.

/** Скорость смаха (px/мс), при которой лист закрывается даже с короткого хода.
 *  0.11 — решение архитектора 24.09.2026: прежние 0.4 требовали рывка, и
 *  обычный быстрый смах листом воспринимался как «не сработало». */
export const CLOSE_VELOCITY = 0.11;
/** Окно, за которое меряется скорость; палец стоял дольше — это уже не смах. */
export const FLICK_WINDOW_MS = 100;

/** Точка касания: время события (e.timeStamp, мс) и положение пальца по y. */
export type DragSample = { t: number; y: number };

/** Добавить точку; старше окна храним только одну — опору для редких точек. */
export function pushSample(samples: DragSample[], sample: DragSample) {
  samples.push(sample);
  while (samples.length > 2 && sample.t - samples[1].t > FLICK_WINDOW_MS)
    samples.shift();
}

/** Средняя скорость вниз (px/мс) за окно до последней точки. Если в окне
 *  только последняя точка (точки редкие), опорой берётся предыдущая. */
export function flickVelocity(samples: readonly DragSample[]): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  let anchor = samples.length - 2;
  while (anchor > 0 && last.t - samples[anchor - 1].t <= FLICK_WINDOW_MS)
    anchor--;
  const first = samples[anchor];
  const dt = last.t - first.t;
  return dt > 0 ? (last.y - first.y) / dt : 0;
}

/** Палец оторвали в endT: смах, если он не стоял дольше окна и шёл быстро. */
export function isFlick(samples: readonly DragSample[], endT: number) {
  const last = samples[samples.length - 1];
  return (
    !!last &&
    endT - last.t < FLICK_WINDOW_MS &&
    flickVelocity(samples) > CLOSE_VELOCITY
  );
}
