// Управление слоем фона: применить настройки к слою и к движку.
// Одним куском — потому что настройки меняются из двух мест: при старте
// (src/config/motion.json) и на ходу из панели /dev/motion.
//
// Режим «не двигается» (mode: "static") останавливает только время линий:
// движок продолжает идти, и сдвиг при прокрутке работает как обычно
// (решение архитектора). Паузу фон себе не берёт.
import type { BackgroundSettings } from "./config-schema";
import { engine } from "./engine";
import type { ContoursLayer } from "./layers/contours";

export interface BackgroundControl {
  apply(settings: BackgroundSettings): void;
  dispose(): void;
}

export function createBackgroundControl(
  layer: ContoursLayer,
): BackgroundControl {
  return {
    apply(settings: BackgroundSettings) {
      layer.setSettings(settings);
      // Инертность — общая для всех слоёв (src/motion/scroll.ts)
      engine.setScrollEase(settings.ease);
      // Если цикл сейчас стоит (пауза, «уменьшить движение», уровень 4) —
      // перерисовать один кадр с новыми значениями
      engine.requestFrame();
    },

    dispose() {},
  };
}
