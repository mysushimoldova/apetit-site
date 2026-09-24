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
import type { SplashSettings } from "@/motion/config-schema";

/**
 * splashProducts — слаги блюд, которые есть в меню этой страницы: по ним
 * заставка выбирает ролик. splashPhotos — адрес фото на каждую категорию:
 * им заставка играет там, где ролика нет. Пусто и то и другое — заставки
 * нет: значит страница не меню.
 */
export default function MotionRuntime({
  splashProducts,
  splashPhotos,
}: {
  splashProducts?: readonly string[];
  splashPhotos?: Readonly<Record<string, string>>;
}) {
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

    // Заставка категории — только на странице меню и только вместе со
    // своими блюдами. Код заставки подтягивается отдельным куском: на
    // остальных страницах он не загружается вовсе.
    let unmountSplash: (() => void) | null = null;
    // Ручка для панели /dev/motion: заставка подключается позже, поэтому
    // панель говорит с этой обёрткой, а та — с контроллером, когда он готов
    let splashControl: {
      apply: (next: SplashSettings) => void;
      play: () => void;
    } | null = null;
    const splashPanel = {
      apply: (next: SplashSettings) => splashControl?.apply(next),
      play: () => splashControl?.play(),
    };
    if (splashProducts && splashProducts.length > 0) {
      const available = new Set(splashProducts);
      void import("@/motion/splash/controller").then((module) => {
        if (cancelled) return;
        const controller = module.createSplashController({
          settings: motionConfig.splash,
          available,
          photos: splashPhotos,
          // Линии фона на заставке приглушаются до своей настройки, а
          // после — возвращаются к обычной
          setLines: (opacity) =>
            background.apply(
              opacity === null ? settings : { ...settings, opacity },
            ),
        });
        const unset = module.setSplashPlayer(controller.play);
        unmountSplash = () => {
          unset();
          controller.dispose();
          splashControl = null;
        };
        splashControl = {
          apply: (next) => controller.setSettings(next),
          // «Проиграть» в панели: первая категория, у которой есть ролики
          play: () => {
            const category = module.firstSplashCategory(available);
            if (category) controller.play(category);
          },
        };
      });
    }

    // Панель /dev/motion — только в разработке. Отдельный import(): в
    // боевой сборке этот кусок кода никогда не запрашивается.
    let cancelled = false;
    let disconnect: (() => void) | null = null;
    if (process.env.NODE_ENV === "development") {
      import("@/motion/dev-bridge").then((bridge) => {
        if (cancelled) return;
        disconnect = bridge.connectDevPanel(
          background,
          productsControl,
          splashPanel,
        );
      });
    }

    return () => {
      cancelled = true;
      unmountSplash?.();
      disconnect?.();
      background.dispose();
      productsControl.dispose();
      engine.remove(products.id);
      engine.remove(layer.id);
      unmount();
    };
  }, [splashProducts, splashPhotos]);

  return null;
}
