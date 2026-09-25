// Ролики заставки: тихая предзагрузка и хранение на время визита.
//
// Правило (решение архитектора 25.09.2026): когда меню отрисовано и страница
// простаивает, заставка сама догружает ролики всех категорий точки — по
// одному, с низким приоритетом (fetch priority "low"), чтобы не спорить за
// сеть ни с главной картинкой, ни с плитками меню. Поэтому уже первое
// нажатие на категорию играет заставку. Никаких <link rel="preload"> и
// ничего в <head>: ролики не в критическом пути страницы.
//
// До первого нажатия — только сеть (download): файл лежит в памяти, и всё.
// Элемент <video>, его разбор и расшифровка кадров — только когда категорию
// впервые играют (take / wait): при загрузке страницы главный поток этой
// работой не занят вовсе.
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
  /** Готовый ролик этого блюда. Ещё не готов — null, и ролик начинает
   *  готовиться (первое воспроизведение категории). */
  take(slug: string): HTMLVideoElement | null;
  /** Ролик, как только он готов, но не дольше ms; не успел — null. */
  wait(slug: string, ms: number): Promise<HTMLVideoElement | null>;
  /** Только скачать файл, с низким приоритетом: ни <video>, ни расшифровки.
   *  Готово, когда файл в памяти (или не скачался). */
  download(slug: string): Promise<void>;
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

/** host — где живут <video>: уголок заставки, его создают при первом показе. */
export function createSplashVideoPool(
  host: () => HTMLElement,
): SplashVideoPool {
  /** Скачанные файлы: слаг → файл в памяти (null — не скачался). */
  const files = new Map<string, Promise<Blob | null>>();
  const pool = new Map<string, Entry>();
  const urls: string[] = [];
  const abort = new AbortController();
  let disposed = false;

  /** Только сеть: файл целиком в память. Второй раз не качаем. */
  function file(slug: string, priority: RequestPriority): Promise<Blob | null> {
    const existing = files.get(slug);
    if (existing) return existing;
    const loading = fetch(splashVideoSrc(slug), {
      priority,
      signal: abort.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`splash ${slug}: ${response.status}`);
        return response.blob();
      })
      .catch(() => {
        // Не скачалось — забываем: следующее нажатие попробует заново
        if (files.get(slug) === loading) files.delete(slug);
        return null;
      });
    files.set(slug, loading);
    return loading;
  }

  /** Первое воспроизведение категории: <video> из скачанного файла. */
  function element(slug: string): Entry {
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
    host().appendChild(video);

    const ready = file(slug, "auto")
      .then((blob) => {
        if (!blob || disposed) return false;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        video.src = url;
        video.load();
        return untilUsable(video);
      })
      .then((ok) => {
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
      const { video } = element(slug);
      return videoUsable(video) ? video : null;
    },

    wait(slug, ms) {
      if (!slug || disposed) return Promise.resolve(null);
      const { video, ready } = element(slug);
      return waitUpTo(
        ready.then((ok) => (ok && videoUsable(video) ? video : null)),
        ms,
        null,
      );
    },

    download(slug) {
      if (!slug || disposed) return Promise.resolve();
      return file(slug, "low").then(() => {});
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
      files.clear();
      for (const url of urls) URL.revokeObjectURL(url);
      urls.length = 0;
    },
  };
}
