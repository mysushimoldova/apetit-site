// Управление слоем карточек блюд: применить настройки к слою и к странице.
// Одним куском — потому что настройки приходят из двух мест: при старте
// (src/config/motion.json) и на ходу из панели /dev/motion.
//
// Делится это так: подъём при прокрутке считает слой движка, а форма тени и
// появление — обычный CSS, поэтому им нужны переменные на <html>. При старте
// те же переменные ставит корневой layout, здесь они только переписываются.
import { applyProductStyle } from "@/lib/product-style";
import type { ProductsSettings } from "./config-schema";
import { engine } from "./engine";
import type { ProductsLayer } from "./layers/products";

export interface ProductsControl {
  apply(settings: ProductsSettings): void;
  dispose(): void;
}

export function createProductsControl(layer: ProductsLayer): ProductsControl {
  return {
    apply(settings: ProductsSettings) {
      layer.setSettings(settings);
      applyProductStyle(document.documentElement, settings);
      // Если цикл сейчас стоит (пауза, «уменьшить движение», уровень 4) —
      // один кадр с новыми значениями
      engine.requestFrame();
    },

    dispose() {},
  };
}
