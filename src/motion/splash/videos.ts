// Ролики заставки: тихая предзагрузка и хранение на время визита.
//
// Правило (решение архитектора 25.09.2026, B0): через секунду после
// отрисовки меню заставка сама догружает ролики всех категорий точки — по
// одному, с низким приоритетом (fetch priority "low"), чтобы не спорить за
// сеть ни с главной картинкой, ни с плитками меню. Поэтому уже первое
// нажатие на категорию играет заставку. Никаких <link rel="preload"> и
// ничего в <head>: ролики не в критическом пути страницы.
//
// Файл и ролик — разные вещи (решение архитектора 25.09.2026, ответ на
// вопрос 2 после B0):
//  • файл (blob:) скачивается для каждой категории точки и живёт, пока
//    открыта страница;
//  • «тёплый» ролик — элемент <video> с готовым первым кадром — это свой
//    декодер в видеокарте. Таких не больше splash.warmMax, а какие именно,
//    решает warm.ts. Нажатие на тёплый чип получает уже разобранный ролик,
//    и заставка встаёт на экран без ~110 мс разбора;
//  • ролик, выпавший из тёплых, отпускает декодер (src снят, load()), а его
//    файл остаётся — согреть ролик снова можно без сети.
// Загрузка кадра в видеокарту и калибровка — по-прежнему только при показе.
//
// Адрес blob: НЕ закрывается до ухода со страницы (пункт B7, решение
// архитектора 25.09.2026 — вопрос закрыт). Замер 25.09.2026: Chrome
// усыпляет стоящий ролик примерно через 20–30 с простоя, а при нажатии
// будит его и перечитывает файл по тому же адресу. Адрес закрыт — ролик
// пуст, и заставка идёт без блюда (тест «через 30 с простоя» в
// e2e/splash.spec.ts). Обычный адрес /splash/….mp4 вместо blob: тоже не
// годится: Safari на iPhone читает ролик кусками и может пойти за ним в
// сеть мимо кеша.
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

/**
 * Первый кадр ролика расшифрован (HAVE_CURRENT_DATA). Согреву этого
 * хватает, чтобы переходить к следующему ролику. Играть
 * заставку — только с уровня READY.
 */
const FIRST_FRAME = 2;

/**
 * Сколько согрев ждёт первый кадр одного ролика, мс. Не дождался —
 * переходит к следующему ролику, а этот готовится дальше сам. Без предела
 * очередь встала бы там, где браузер заранее разбирает только размеры
 * ролика (iPhone в режиме энергосбережения), и остальные ролики не
 * скачались бы вовсе.
 */
export const FIRST_FRAME_WAIT = 2000;

/** Что от <video> нужно ожиданию: уровень готовности и события. Тесту
 *  хватает поддельного объекта. */
type MediaState = EventTarget & { readonly readyState: number };

/** События, после которых уровень готовности мог вырасти. */
const PROGRESS = ["loadeddata", "canplay", "canplaythrough"] as const;

/** Дождаться, пока ролик дойдёт до уровня level. Ошибка — false. */
export function untilLevel(video: MediaState, level: number): Promise<boolean> {
  if (video.readyState >= level) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      for (const type of PROGRESS) video.removeEventListener(type, onProgress);
      video.removeEventListener("error", onError);
      resolve(ok);
    };
    const onProgress = () => {
      if (video.readyState >= level) done(true);
    };
    const onError = () => done(false);
    for (const type of PROGRESS) video.addEventListener(type, onProgress);
    video.addEventListener("error", onError);
  });
}

export interface SplashVideoPool {
  /** Готовый ролик этого блюда. Ещё не готов — null, и ролик начинает
   *  готовиться (нажатие на «холодный» чип). */
  take(slug: string): HTMLVideoElement | null;
  /** Ролик, как только он готов, но не дольше ms; не успел — null. */
  wait(slug: string, ms: number): Promise<HTMLVideoElement | null>;
  /** Скачать файл ролика с низким приоритетом. true — файл в памяти. */
  download(slug: string): Promise<boolean>;
  /** Файл ролика уже в памяти: согреть ролик можно без сети. */
  hasFile(slug: string): boolean;
  /** Согреть ролик: сделать <video> и дождаться первого кадра, но не
   *  дольше FIRST_FRAME_WAIT. Готово — можно греть следующий. */
  warm(slug: string): Promise<void>;
  /** Ролик отпускает декодер: src снят, load(), элемент убран. Файл
   *  остаётся. */
  release(slug: string): void;
  /** Ролики, у которых сейчас есть <video>: тёплые и те, что греются. */
  warmSlugs(): string[];
  dispose(): void;
}

interface Entry {
  video: HTMLVideoElement;
  /** Первый кадр расшифрован (true) или ролик не разобрался (false). */
  frame: Promise<boolean>;
  /** Ролик готов играть (true) или загрузка не удалась (false). */
  ready: Promise<boolean>;
  /** Ролик отпущен: ожидания кадра заканчиваются сразу. */
  drop: () => void;
}

/** host — где живут <video>: невидимый уголок в DOM заставки. */
export function createSplashVideoPool(
  host: () => HTMLElement,
): SplashVideoPool {
  /** Файлы роликов: слаг → адрес blob: (null — не скачался). Живут до ухода
   *  со страницы, даже когда ролик отпущен (см. шапку файла). */
  const files = new Map<string, Promise<string | null>>();
  /** Те же адреса, но только уже скачанные. */
  const urls = new Map<string, string>();
  const pool = new Map<string, Entry>();
  const abort = new AbortController();
  let disposed = false;

  /** Только сеть: файл целиком в память. Второй раз не качаем. */
  function file(
    slug: string,
    priority: RequestPriority,
  ): Promise<string | null> {
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
      .then((blob) => {
        if (disposed) return null;
        const url = URL.createObjectURL(blob);
        urls.set(slug, url);
        return url;
      })
      .catch(() => {
        // Не скачалось — забываем: следующее нажатие попробует заново
        if (files.get(slug) === loading) files.delete(slug);
        return null;
      });
    files.set(slug, loading);
    return loading;
  }

  /** Файл сломан: закрыть адрес; в следующий раз файл скачается заново,
   *  уже из кеша браузера. */
  function dropFile(slug: string): void {
    const url = urls.get(slug);
    if (url) URL.revokeObjectURL(url);
    urls.delete(slug);
    files.delete(slug);
  }

  /** Декодер отпущен, элемент убран. Файл не трогаем. */
  function unload(entry: Entry): void {
    entry.drop();
    const { video } = entry;
    try {
      video.pause();
    } catch {
      // Ролик мог не догрузиться — отпустить его это не мешает
    }
    video.removeAttribute("src");
    video.load();
    video.remove();
  }

  /** <video> из скачанного файла: греет очередь тёплых роликов, а если
   *  ролик холодный — нажатие. */
  function element(slug: string, priority: RequestPriority): Entry {
    const existing = pool.get(slug);
    if (existing) return existing;
    const video = document.createElement("video");
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("aria-hidden", "true");
    // По нему тесты находят ролик нужного блюда
    video.setAttribute("data-slug", slug);
    video.preload = "auto";
    video.loop = false;
    host().appendChild(video);

    let drop = () => {};
    const dropped = new Promise<false>((resolve) => {
      drop = () => resolve(false);
    });
    const current = () => pool.get(slug)?.video === video;

    // Ролик сломался (и до первого кадра, и после) — забываем и его, и
    // файл: следующее нажатие скачает файл заново, уже из кеша браузера
    const forget = () => {
      video.removeEventListener("error", forget);
      if (!current()) return;
      pool.delete(slug);
      video.remove();
      dropFile(slug);
    };
    video.addEventListener("error", forget);

    const frame = file(slug, priority)
      .then((url) => {
        if (!url || disposed || !current()) return false;
        video.src = url;
        video.load();
        return Promise.race([untilLevel(video, FIRST_FRAME), dropped]);
      })
      .then((ok) => {
        if (!ok) forget();
        return ok;
      });
    const ready = frame.then(
      (ok) => ok && Promise.race([untilLevel(video, READY), dropped]),
    );

    const entry: Entry = {
      video,
      frame,
      ready,
      drop: () => {
        video.removeEventListener("error", forget);
        drop();
      },
    };
    pool.set(slug, entry);
    return entry;
  }

  return {
    take(slug) {
      if (!slug || disposed) return null;
      const { video } = element(slug, "auto");
      return videoUsable(video) ? video : null;
    },

    wait(slug, ms) {
      if (!slug || disposed) return Promise.resolve(null);
      const { video, ready } = element(slug, "auto");
      return waitUpTo(
        ready.then((ok) => (ok && videoUsable(video) ? video : null)),
        ms,
        null,
      );
    },

    download(slug) {
      if (!slug || disposed) return Promise.resolve(false);
      return file(slug, "low").then((url) => url !== null);
    },

    hasFile(slug) {
      return urls.has(slug);
    },

    warm(slug) {
      if (!slug || disposed) return Promise.resolve();
      return waitUpTo(element(slug, "low").frame, FIRST_FRAME_WAIT, false).then(
        () => {},
      );
    },

    release(slug) {
      const entry = pool.get(slug);
      if (!entry) return;
      pool.delete(slug);
      unload(entry);
    },

    warmSlugs() {
      return [...pool.keys()];
    },

    dispose() {
      disposed = true;
      abort.abort();
      for (const entry of pool.values()) unload(entry);
      pool.clear();
      files.clear();
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
    },
  };
}
