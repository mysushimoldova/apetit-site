// Ролики заставки: тихая предзагрузка и хранение на время визита.
//
// Правило (решение архитектора 25.09.2026, B0): через секунду после
// отрисовки меню заставка сама догружает ролики всех категорий точки — по
// одному, с низким приоритетом (fetch priority "low"), чтобы не спорить за
// сеть ни с главной картинкой, ни с плитками меню. Поэтому уже первое
// нажатие на категорию играет заставку. Никаких <link rel="preload"> и
// ничего в <head>: ролики не в критическом пути страницы.
//
// Сразу после скачивания ролик становится элементом <video>, и заставка
// ждёт его первого готового кадра (readyState ≥ 2) — тоже по одному, не
// параллельно (решение архитектора 25.09.2026, вариант «б»). Так нажатие
// получает уже разобранный ролик и заставка встаёт на экран без ~110 мс
// разбора. Загрузка кадра в видеокарту и калибровка — по-прежнему только
// при показе.
//
// Адрес blob: у готового ролика НЕ закрывается до ухода со страницы, хотя
// архитектор просил отпускать файл сразу после первого кадра (пункт B7).
// Замер 25.09.2026: Chrome усыпляет стоящий ролик примерно через 20–30 с
// простоя, а при нажатии будит его и перечитывает файл по тому же адресу.
// Адрес закрыт — ролик пуст, и заставка идёт без блюда (тест «через 30 с
// простоя» в e2e/splash.spec.ts). Своя ссылка на файл после первого кадра
// всё же убирается (files): файл держит только адрес ролика.
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
 * Первый кадр ролика расшифрован (HAVE_CURRENT_DATA). Предзагрузке этого
 * хватает, чтобы переходить к следующему ролику. Играть
 * заставку — только с уровня READY.
 */
const FIRST_FRAME = 2;

/**
 * Сколько предзагрузка ждёт первый кадр одного ролика, мс. Не дождалась —
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
   *  готовиться (если предзагрузка до него ещё не дошла). */
  take(slug: string): HTMLVideoElement | null;
  /** Ролик, как только он готов, но не дольше ms; не успел — null. */
  wait(slug: string, ms: number): Promise<HTMLVideoElement | null>;
  /** Предзагрузка одного ролика: скачать файл с низким приоритетом, сделать
   *  <video> и дождаться первого кадра (не дольше FIRST_FRAME_WAIT после
   *  скачивания). Готово — можно браться за следующий. */
  preload(slug: string): Promise<void>;
  dispose(): void;
}

interface Entry {
  video: HTMLVideoElement;
  /** Первый кадр расшифрован (true) или ролик не разобрался (false). */
  frame: Promise<boolean>;
  /** Ролик готов играть (true) или загрузка не удалась (false). */
  ready: Promise<boolean>;
}

/** host — где живут <video>: невидимый уголок в DOM заставки. */
export function createSplashVideoPool(
  host: () => HTMLElement,
): SplashVideoPool {
  /** Скачанные и ещё не отданные ролику файлы: слаг → файл в памяти (null
   *  — не скачался). Как только у ролика есть первый кадр, файл отсюда
   *  уходит: дальше его держит адрес blob: самого ролика. */
  const files = new Map<string, Promise<Blob | null>>();
  const pool = new Map<string, Entry>();
  /** Открытые адреса blob: — закрываются, только когда ролик забыт или
   *  страница ушла (см. шапку файла). */
  const urls = new Set<string>();
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

  function closeUrl(url: string): void {
    if (url && urls.delete(url)) URL.revokeObjectURL(url);
  }

  /** <video> из скачанного файла: создаёт предзагрузка, а если она до
   *  этого ролика ещё не дошла — нажатие. */
  function element(slug: string, priority: RequestPriority): Entry {
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

    let url = "";
    const forget = () => {
      closeUrl(url);
      if (pool.get(slug)?.video !== video) return;
      pool.delete(slug);
      video.remove();
    };
    // Ролик сломался и после первого кадра: забываем его — следующее
    // нажатие скачает файл заново, уже из кеша браузера
    video.addEventListener("error", forget);

    const frame = file(slug, priority)
      .then((blob) => {
        if (!blob || disposed) return false;
        url = URL.createObjectURL(blob);
        urls.add(url);
        video.src = url;
        video.load();
        return untilLevel(video, FIRST_FRAME);
      })
      .then((ok) => {
        // Файл теперь держит адрес ролика; не разобрался — забываем всё
        files.delete(slug);
        if (!ok) forget();
        return ok;
      });
    const ready = frame.then((ok) => ok && untilLevel(video, READY));

    const entry = { video, frame, ready };
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

    preload(slug) {
      if (!slug || disposed) return Promise.resolve();
      // Нажатие могло опередить очередь: ролик уже есть — ждём только его
      // первый кадр. Предел — после скачивания, а не от начала: на медленной
      // сети файлы иначе пошли бы параллельно.
      const downloaded = pool.has(slug)
        ? Promise.resolve(true)
        : file(slug, "low").then((blob) => blob !== null);
      return downloaded
        .then((ok) =>
          ok && !disposed
            ? waitUpTo(element(slug, "low").frame, FIRST_FRAME_WAIT, false)
            : false,
        )
        .then(() => {});
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
      urls.clear();
    },
  };
}
