// Фото для заставки категорий без ролика: тихая предзагрузка и хранение на
// время визита. Устроено как src/motion/splash/videos.ts и по тем же
// правилам.
//
// Это те же вырезанные картинки, что на плитках меню (public/img/products,
// прозрачный фон), поэтому новых файлов заставке не нужно, а браузер часто
// отдаёт их прямо из кеша: плитка этой категории уже была на экране.
//
// При открытии сайта заставка ничего не грузит. Когда страница показана и
// простаивает, файлы скачиваются с низким приоритетом в кеш браузера (у
// /img/ он вечный, src/lib/cache-headers.ts) — и только. Картинка и её
// расшифровка — при первом воспроизведении категории, уже из кеша.
import { waitUpTo } from "./wait";

export interface SplashPhotoPool {
  /** Готовая (расшифрованная) картинка для этого адреса; ещё не готова —
   *  null, и она начинает готовиться (первое воспроизведение категории). */
  take(src: string): HTMLImageElement | null;
  /** Картинка, как только она готова, но не дольше ms; не успела — null. */
  wait(src: string, ms: number): Promise<HTMLImageElement | null>;
  /** Только скачать файл в кеш браузера, с низким приоритетом. */
  download(src: string): Promise<void>;
  dispose(): void;
}

interface Entry {
  image: HTMLImageElement;
  /** Картинка расшифрована и её можно отдать видеокарте. */
  ready: Promise<boolean>;
  decoded: boolean;
}

/** Картинка догрузилась и её можно отдать видеокарте. */
function loaded(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0;
}

export function createSplashPhotoPool(): SplashPhotoPool {
  const pool = new Map<string, Entry>();
  const files = new Map<string, Promise<void>>();
  const abort = new AbortController();

  /** Первое воспроизведение категории: картинка из кеша, расшифровка вне
   *  главного потока (decode), а не в кадре заставки. */
  function element(src: string): Entry {
    const existing = pool.get(src);
    if (existing) return existing;
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    const entry: Entry = {
      image,
      ready: Promise.resolve(false),
      decoded: false,
    };
    entry.ready = image
      .decode()
      .then(
        () => true,
        () => loaded(image),
      )
      .then((ok) => {
        entry.decoded = ok;
        // Не загрузилась — забываем: следующее нажатие попробует заново
        if (!ok && pool.get(src) === entry) pool.delete(src);
        return ok;
      });
    pool.set(src, entry);
    return entry;
  }

  return {
    take(src) {
      if (!src) return null;
      const entry = element(src);
      return entry.decoded ? entry.image : null;
    },

    wait(src, ms) {
      if (!src) return Promise.resolve(null);
      const { image, ready } = element(src);
      return waitUpTo(
        ready.then((ok) => (ok ? image : null)),
        ms,
        null,
      );
    },

    download(src) {
      if (!src) return Promise.resolve();
      const existing = files.get(src);
      if (existing) return existing;
      // Тело читаем до конца: иначе файл не ляжет в кеш целиком
      const loading = fetch(src, { priority: "low", signal: abort.signal })
        .then((response) => response.blob())
        .then(
          () => {},
          () => {
            files.delete(src);
          },
        );
      files.set(src, loading);
      return loading;
    },

    dispose() {
      abort.abort();
      for (const { image } of pool.values()) image.src = "";
      pool.clear();
      files.clear();
    },
  };
}
