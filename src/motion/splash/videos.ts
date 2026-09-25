// Ролики заставки: тихая предзагрузка и хранение на время визита.
//
// Правило (решение архитектора 25.09.2026): когда меню отрисовано и страница
// простаивает, заставка сама догружает ролики всех категорий точки — по
// одному, с низким приоритетом (fetch priority "low"), чтобы не спорить за
// сеть ни с главной картинкой, ни с плитками меню. Поэтому уже первое
// нажатие на категорию играет заставку. Никаких <link rel="preload"> и
// ничего в <head>: ролики не в критическом пути страницы.
//
// Почему fetch, а не просто <video preload>: у <video> нельзя задать
// приоритет загрузки. Файл скачивается fetch-ем целиком и отдаётся ролику
// из памяти (blob:), поэтому второй раз по сети он не идёт. Разрешение на
// blob: — media-src в src/lib/security-headers.ts.
//
// Элементы <video> живут в DOM размером 1×1 и невидимыми: часть браузеров
// не отдаёт кадры в WebGL у элемента, которого нет на странице.
import { splashVideoSrc } from "./catalog";
import { waitUpTo } from "./wait";

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
  /** Готовый ролик этого блюда. Ещё не загружен — null, и загрузка
   *  запускается (или продолжается) в фоне. */
  take(slug: string): HTMLVideoElement | null;
  /** Ролик, как только он готов, но не дольше ms; не успел — null. */
  wait(slug: string, ms: number): Promise<HTMLVideoElement | null>;
  /** Тихо загрузить эти ролики по одному, с низким приоритетом. */
  prefetch(slugs: readonly string[]): void;
  dispose(): void;
}

interface Entry {
  video: HTMLVideoElement;
  /** Ролик готов играть (true) или загрузка не удалась (false). */
  ready: Promise<boolean>;
}

/** Дождаться, пока ролик из памяти станет готов к показу. */
function untilUsable(video: HTMLVideoElement): Promise<boolean> {
  if (videoUsable(video)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      video.removeEventListener("canplaythrough", onReady);
      video.removeEventListener("error", onError);
      resolve(ok);
    };
    const onReady = () => {
      if (videoUsable(video)) done(true);
    };
    const onError = () => done(false);
    video.addEventListener("canplaythrough", onReady);
    video.addEventListener("error", onError);
  });
}

export function createSplashVideoPool(host: HTMLElement): SplashVideoPool {
  const pool = new Map<string, Entry>();
  const urls: string[] = [];
  const abort = new AbortController();
  let disposed = false;

  function load(slug: string, priority: RequestPriority): Entry {
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
    host.appendChild(video);

    const ready = fetch(splashVideoSrc(slug), {
      priority,
      signal: abort.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`splash ${slug}: ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (disposed) return false;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        video.src = url;
        video.load();
        return untilUsable(video);
      })
      .catch(() => false)
      .then((ok) => {
        // Не загрузилось — забываем: следующее нажатие попробует заново
        if (!ok && pool.get(slug)?.video === video) {
          pool.delete(slug);
          video.remove();
        }
        return ok;
      });

    const entry = { video, ready };
    pool.set(slug, entry);
    return entry;
  }

  return {
    take(slug) {
      if (!slug || disposed) return null;
      const { video } = load(slug, "auto");
      return videoUsable(video) ? video : null;
    },

    wait(slug, ms) {
      if (!slug || disposed) return Promise.resolve(null);
      const { video, ready } = load(slug, "auto");
      return waitUpTo(
        ready.then((ok) => (ok && videoUsable(video) ? video : null)),
        ms,
        null,
      );
    },

    prefetch(slugs) {
      // По одному: пока качается ролик, сеть остаётся свободной для того,
      // что человек листает прямо сейчас
      void slugs.reduce<Promise<unknown>>(
        (previous, slug) =>
          previous.then(() => (disposed ? false : load(slug, "low").ready)),
        Promise.resolve(),
      );
    },

    dispose() {
      disposed = true;
      abort.abort();
      for (const { video } of pool.values()) {
        video.pause();
        video.removeAttribute("src");
        video.load();
        video.remove();
      }
      pool.clear();
      for (const url of urls) URL.revokeObjectURL(url);
      urls.length = 0;
    },
  };
}
