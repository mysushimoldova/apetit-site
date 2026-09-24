// Что играет на заставке категории (docs/motion/splash-prompt.md).
//
// Заставка есть у КАЖДОЙ категории. Где сняты ролики — играет ролик; где нет
// (menu, crispy, hot-dog, pizza, cartofi и любые будущие) — та же заставка,
// но вместо ролика вырезанное фото первого доступного в точке блюда: те же
// картинки, что на плитках меню. Нет ни ролика, ни фото — заставки нет,
// переход к категории обычный, без ошибок в консоли.
//
// Слаг ролика = слаг блюда = имя файла в public/splash.
export const SPLASH_VIDEOS: Readonly<Record<string, readonly string[]>> = {
  kebab: ["kebab-xl-xxl", "kebab-cheese"],
  burgers: ["cheeseburger-dublu-vita", "hamburger-dublu-vita"],
  gozleme: ["gozleme-carne", "gozleme-mozzarella"],
  sandwich: ["sandwich-salam", "sandwich-sunca"],
  salad: ["salata-cezar", "salata-greceasca"],
  supe: ["supa-bostan", "supa-spanac"],
  drinks: ["cola", "fanta"],
  desert: ["brinzoaice"],
  sosuri: ["sos-ketchup", "sos-usturoi"],
};

/** Адрес ролика. Заголовки кеша — next.config.ts (год, immutable). */
export function splashVideoSrc(slug: string): string {
  return `/splash/${slug}.mp4`;
}

/**
 * Ролики для заставки этой категории, в порядке показа.
 *
 * available — слаги блюд, которые есть в меню выбранной точки. Нет первого
 * блюда — играет второе; нет ни одного (или у категории нет роликов) —
 * пустой список, и в ход идёт фото.
 */
export function splashVideosFor(
  categorySlug: string,
  available: ReadonlySet<string>,
  count: number,
): string[] {
  const all = SPLASH_VIDEOS[categorySlug];
  if (!all) return [];
  const usable = all.filter((slug) => available.has(slug));
  return usable.slice(0, Math.max(1, Math.round(count)));
}

/** Фото категорий: слаг категории → адрес картинки первого доступного в
 *  точке блюда. Список собирает страница меню (src/routes/city-menu.tsx):
 *  только там известно, что точка продаёт и какие ширины есть у файла. */
export type SplashPhotos = Readonly<Record<string, string>>;

/** Чем играть заставку этой категории. */
export type SplashMode =
  | { kind: "video"; slugs: string[] }
  | { kind: "photo"; src: string }
  | { kind: "none" };

/**
 * Режим заставки: сначала ролики, потом фото, потом ничего.
 *
 * Ролики важнее фото даже там, где есть и то и другое: в ролике блюдо
 * вращается, это и задумано как заставка. Фото — для категорий, где ролика
 * нет вовсе или где снятых блюд нет в меню этой точки.
 */
export function splashModeFor(
  categorySlug: string,
  available: ReadonlySet<string>,
  count: number,
  photos: SplashPhotos | undefined,
): SplashMode {
  const slugs = splashVideosFor(categorySlug, available, count);
  if (slugs.length > 0) return { kind: "video", slugs };
  const src = photos?.[categorySlug];
  if (src) return { kind: "photo", src };
  return { kind: "none" };
}
