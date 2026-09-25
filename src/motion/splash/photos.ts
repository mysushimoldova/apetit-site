// Фото для заставки категорий без ролика: тихая предзагрузка и хранение на
// время визита. Устроено как src/motion/splash/videos.ts и по тем же
// правилам.
//
// Это те же вырезанные картинки, что на плитках меню (public/img/products,
// прозрачный фон), поэтому новых файлов заставке не нужно, а браузер часто
// отдаёт их прямо из кеша: плитка этой категории уже была на экране.
//
// При открытии сайта заставка ничего не грузит. Когда страница показана и
// простаивает, картинки догружаются с низким приоритетом — и уже первое
// нажатие на категорию играет заставку. Так же, как с роликами.
import { waitUpTo } from "./wait";

export interface SplashPhotoPool {
  /** Готовая картинка для этого адреса; ещё не загружена — null, и
   *  загрузка начинается (или продолжается) в фоне. */
  take(src: string): HTMLImageElement | null;
  /** Картинка, как только она готова, но не дольше ms; не успела — null. */
  wait(src: string, ms: number): Promise<HTMLImageElement | null>;
  /** Тихо загрузить эти картинки с низким приоритетом. */
  prefetch(srcs: readonly string[]): void;
  dispose(): void;
}

/** Картинка догрузилась и её можно отдать видеокарте. */
function ready(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0;
}

function untilReady(image: HTMLImageElement): Promise<boolean> {
  if (ready(image)) return Promise.resolve(true);
  return new Promise((resolve) => {
    image.addEventListener("load", () => resolve(ready(image)), {
      once: true,
    });
    image.addEventListener("error", () => resolve(false), { once: true });
  });
}

export function createSplashPhotoPool(): SplashPhotoPool {
  const pool = new Map<string, HTMLImageElement>();

  function element(
    src: string,
    priority: HTMLImageElement["fetchPriority"],
  ): HTMLImageElement {
    const existing = pool.get(src);
    if (existing) return existing;
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = priority;
    image.src = src;
    pool.set(src, image);
    return image;
  }

  return {
    take(src) {
      if (!src) return null;
      const image = element(src, "auto");
      return ready(image) ? image : null;
    },

    wait(src, ms) {
      if (!src) return Promise.resolve(null);
      const image = element(src, "auto");
      return waitUpTo(
        untilReady(image).then((ok) => (ok ? image : null)),
        ms,
        null,
      );
    },

    prefetch(srcs) {
      for (const src of srcs) element(src, "low");
    },

    dispose() {
      for (const image of pool.values()) image.src = "";
      pool.clear();
    },
  };
}
