// Фото для заставки категорий без ролика: загрузка по требованию и хранение
// на время визита. Устроено как src/motion/splash/videos.ts и по тем же
// правилам.
//
// Это те же вырезанные картинки, что на плитках меню (public/img/products,
// прозрачный фон), поэтому новых файлов заставке не нужно, а браузер часто
// отдаёт их прямо из кеша: плитка этой категории уже была на экране.
//
// При открытии сайта заставка ничего не грузит. Первое нажатие на категорию
// заставку не показывает (переход обычный), но ставит картинку в загрузку —
// со второго раза заставка играет. Так же, как с роликами.

export interface SplashPhotoPool {
  /** Готовая картинка для этого адреса; ещё не загружена — null, и
   *  загрузка начинается (или продолжается) в фоне. */
  take(src: string): HTMLImageElement | null;
  /** Поставить в загрузку, ничего не ожидая. */
  warm(src: string): void;
  dispose(): void;
}

/** Картинка догрузилась и её можно отдать видеокарте. */
function ready(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0;
}

export function createSplashPhotoPool(): SplashPhotoPool {
  const pool = new Map<string, HTMLImageElement>();

  function element(src: string): HTMLImageElement {
    const existing = pool.get(src);
    if (existing) return existing;
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    pool.set(src, image);
    return image;
  }

  return {
    take(src) {
      if (!src) return null;
      const image = element(src);
      return ready(image) ? image : null;
    },

    warm(src) {
      if (src) element(src);
    },

    dispose() {
      for (const image of pool.values()) image.src = "";
      pool.clear();
    },
  };
}
