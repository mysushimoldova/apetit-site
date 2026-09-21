// Управление слоем фона: применить настройки к слою и к движку.
// Одним куском — потому что настройки меняются из двух мест: при старте
// (src/config/motion.json) и на ходу из панели /dev/motion.
import type { BackgroundSettings } from "./config-schema";
import { engine } from "./engine";
import type { ContoursLayer } from "./layers/contours";

/** Причина паузы, которую фон берёт себе в режиме «не двигается». */
export const BACKGROUND_STATIC = "background-static";

export interface BackgroundControl {
  apply(settings: BackgroundSettings): void;
  dispose(): void;
}

export function createBackgroundControl(
  layer: ContoursLayer,
): BackgroundControl {
  let stopped = false;

  return {
    apply(settings: BackgroundSettings) {
      layer.setSettings(settings);
      // Инертность — общая для всех слоёв (src/motion/scroll.ts)
      engine.setScrollEase(settings.ease);
      const still = settings.mode === "static";
      if (still && !stopped) {
        stopped = true;
        engine.pause(BACKGROUND_STATIC);
      } else if (!still && stopped) {
        stopped = false;
        engine.resume(BACKGROUND_STATIC);
      }
      // В режиме «не двигается» цикл стоит — перерисовываем один кадр
      engine.requestFrame();
    },

    dispose() {
      if (!stopped) return;
      stopped = false;
      engine.resume(BACKGROUND_STATIC);
    },
  };
}
