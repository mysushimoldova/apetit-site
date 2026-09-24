// Ролики заставки: загрузка по требованию и хранение на время визита.
//
// Правило из задания: при открытии сайта не грузится ничего. Первое нажатие
// на категорию заставки не показывает (переход обычный), но ставит ролики
// этой категории в загрузку — со второго раза заставка уже играет. Никаких
// <link rel="preload">: ролики не должны соперничать за сеть с главной
// картинкой страницы.
//
// Элементы <video> живут в DOM размером 1×1 и невидимыми: часть браузеров
// не отдаёт кадры в WebGL у элемента, которого нет на странице.
import { splashVideoSrc } from "./catalog";

/**
 * Ролик готов играть заставку — HAVE_ENOUGH_DATA, не меньше.
 *
 * Было HAVE_CURRENT_DATA (2), и это и есть та самая ошибка, из-за которой на
 * телефоне заставка у категорий с роликом показывала пустой кремовый экран:
 * уровень 2 означает «расшифрован один кадр», а не «файл загружен». Заставка
 * тут же перематывала такой ролик на ноль и включала воспроизведение — ролик
 * уходил в перемотку и подкачку, кадров видеокарте не доставалось, и на
 * экране оставался кремовый фон с жёлтым кругом. Правило задания — «если
 * файл ещё не загружен, заставка не играет» (docs/motion/splash-prompt.md,
 * раздел ЗАГРУЗКА), и «загружен» — это именно уровень 4.
 */
const READY = 4;

/** Ролик можно отдавать заставке? Отдельная функция — её проверяет тест. */
export function videoUsable(video: { readyState: number }): boolean {
  return video.readyState >= READY;
}

export interface SplashVideoPool {
  /**
   * Готовые ролики для этих слагов. Если хоть один ещё не готов — null,
   * и загрузка запускается (или продолжается) в фоне.
   */
  take(slugs: readonly string[]): HTMLVideoElement[] | null;
  /** Поставить в загрузку, ничего не ожидая. */
  warm(slugs: readonly string[]): void;
  dispose(): void;
}

export function createSplashVideoPool(host: HTMLElement): SplashVideoPool {
  const pool = new Map<string, HTMLVideoElement>();

  function element(slug: string): HTMLVideoElement {
    const existing = pool.get(slug);
    if (existing) return existing;
    const video = document.createElement("video");
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("aria-hidden", "true");
    video.preload = "auto";
    video.loop = false;
    video.src = splashVideoSrc(slug);
    video.load();
    host.appendChild(video);
    pool.set(slug, video);
    return video;
  }

  return {
    take(slugs) {
      if (slugs.length === 0) return null;
      const videos = slugs.map(element);
      if (!videos.every(videoUsable)) return null;
      return videos;
    },

    warm(slugs) {
      for (const slug of slugs) element(slug);
    },

    dispose() {
      for (const video of pool.values()) {
        video.pause();
        video.removeAttribute("src");
        video.load();
        video.remove();
      }
      pool.clear();
    },
  };
}
