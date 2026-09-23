"use client";
// Подключение движка к странице: холст, слои (фон и карточки блюд), настройки
// из src/config/motion.json. Этот кусок кода грузится отдельно и только после
// того, как страница показана (motion-stage.tsx).
import { useEffect } from "react";
import { motionConfig } from "@/config/motion";
import { createBackgroundControl } from "@/motion/background";
import { engine } from "@/motion/engine";
import { createContoursLayer } from "@/motion/layers/contours";
import { createProductsLayer } from "@/motion/layers/products";
import { createProductsControl } from "@/motion/products";

export default function MotionRuntime() {
  useEffect(() => {
    const settings = motionConfig.background;
    const layer = createContoursLayer(settings);
    const products = createProductsLayer(motionConfig.products);
    const unmount = engine.mount({ scrollEase: settings.ease });
    engine.add(layer);
    engine.add(products);
    const background = createBackgroundControl(layer);
    background.apply(settings);
    const productsControl = createProductsControl(products);

    // Панель /dev/motion — только в разработке. Отдельный import(): в
    // боевой сборке этот кусок кода никогда не запрашивается.
    let cancelled = false;
    let disconnect: (() => void) | null = null;
    if (process.env.NODE_ENV === "development") {
      import("@/motion/dev-bridge").then((bridge) => {
        if (cancelled) return;
        disconnect = bridge.connectDevPanel(background, productsControl);
      });
    }

    return () => {
      cancelled = true;
      disconnect?.();
      background.dispose();
      productsControl.dispose();
      engine.remove(products.id);
      engine.remove(layer.id);
      unmount();
    };
  }, []);

  return null;
}
