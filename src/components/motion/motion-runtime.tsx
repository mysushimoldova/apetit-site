"use client";
// Подключение движка к странице: холст, слой фона, настройки из
// src/config/motion.json. Этот кусок кода грузится отдельно и только
// после того, как страница показана (motion-stage.tsx).
import { useEffect } from "react";
import { motionConfig } from "@/config/motion";
import { createBackgroundControl } from "@/motion/background";
import { engine } from "@/motion/engine";
import { createContoursLayer } from "@/motion/layers/contours";

export default function MotionRuntime() {
  useEffect(() => {
    const settings = motionConfig.background;
    const layer = createContoursLayer(settings);
    const unmount = engine.mount({ scrollEase: settings.ease });
    engine.add(layer);
    const background = createBackgroundControl(layer);
    background.apply(settings);

    // Панель /dev/motion — только в разработке. Отдельный import(): в
    // боевой сборке этот кусок кода никогда не запрашивается.
    let cancelled = false;
    let disconnect: (() => void) | null = null;
    if (process.env.NODE_ENV === "development") {
      import("@/motion/dev-bridge").then((bridge) => {
        if (cancelled) return;
        disconnect = bridge.connectDevPanel(background);
      });
    }

    return () => {
      cancelled = true;
      disconnect?.();
      background.dispose();
      engine.remove(layer.id);
      unmount();
    };
  }, []);

  return null;
}
