// Мост «панель → движок» для /dev/motion. Панель показывает настоящую
// страницу меню в <iframe> и шлёт туда настройки; страница отвечает
// кадрами в секунду и уровнем качества.
//
// Только разработка: модуль подгружается отдельным куском и в боевой
// сборке никогда не запрашивается (см. motion-runtime.tsx). Сообщения
// принимаются только со своего адреса и проверяются схемой zod.
import { applyPageTheme } from "@/lib/page-theme";
import type { BackgroundControl } from "./background";
import {
  backgroundSchema,
  pageSchema,
  productsSchema,
  splashSchema,
} from "./config-schema";
import {
  PANEL_SOURCE,
  STAGE_SOURCE,
  type PanelMessage,
  type StageMessage,
} from "./dev-messages";
import { engine } from "./engine";
import type { ProductsControl } from "./products";
import type { SplashSettings } from "./config-schema";

/** Что панель умеет делать с заставкой: менять настройки и проигрывать. */
export interface SplashPanelControl {
  apply(settings: SplashSettings): void;
  play(): void;
}

/** Как часто страница сообщает панели кадры в секунду, мс. */
const STATS_MS = 500;

export function connectDevPanel(
  control: BackgroundControl,
  products: ProductsControl,
  splash?: SplashPanelControl,
): () => void {
  const parent = window.parent;
  // Страница открыта сама по себе, не в панели — ничего не делаем
  if (!parent || parent === window) return () => {};
  const origin = window.location.origin;

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== origin) return;
    const data = event.data as PanelMessage | null;
    if (!data || data.source !== PANEL_SOURCE) return;
    const parsed = backgroundSchema.safeParse(data.background);
    if (parsed.success) control.apply(parsed.data);
    const tiles = productsSchema.safeParse(data.products);
    if (tiles.success) products.apply(tiles.data);
    const screen = splashSchema.safeParse(data.splash);
    if (screen.success) splash?.apply(screen.data);
    if (data.play === "splash") splash?.play();
    // Цвет фона страницы — не слой движка: это переменные CSS на <html>
    const page = pageSchema.safeParse(data.page);
    if (page.success) {
      applyPageTheme(document.documentElement, page.data.background);
    }
    engine.setReducedMotion(data.reducedMotion === true ? true : null);
  };
  window.addEventListener("message", onMessage);

  const post = (message: StageMessage) => parent.postMessage(message, origin);
  post({ source: STAGE_SOURCE, ready: true });
  const timer = window.setInterval(() => {
    const stats = engine.stats();
    post({
      source: STAGE_SOURCE,
      stats: {
        fps: stats.fps,
        quality: stats.quality,
        running: stats.running,
        paused: stats.paused,
      },
    });
  }, STATS_MS);

  return () => {
    window.removeEventListener("message", onMessage);
    clearInterval(timer);
  };
}
