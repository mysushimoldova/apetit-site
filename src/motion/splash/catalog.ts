// Что играет на заставке категории (docs/motion/splash-prompt.md).
//
// Заставка есть у КАЖДОЙ категории и показывает ОДНО блюдо — первое из
// доступных в выбранной точке. Где снят ролик — играет ролик; где нет
// (menu, crispy, hot-dog, pizza, cartofi и любые будущие) — та же заставка,
// но вместо ролика вырезанное фото того же первого блюда. Нет ни ролика,
// ни фото — заставки нет, переход к категории обычный, без ошибок в консоли.
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
 * Ролик заставки этой категории — один, всегда.
 *
 * available — слаги блюд, которые есть в меню выбранной точки. Нет первого
 * блюда — играет второе; нет ни одного (или у категории нет роликов) —
 * null, и в ход идёт фото.
 */
export function splashVideoFor(
  categorySlug: string,
  available: ReadonlySet<string>,
): string | null {
  const all = SPLASH_VIDEOS[categorySlug];
  if (!all) return null;
  return all.find((slug) => available.has(slug)) ?? null;
}

/** Фото категорий: слаг категории → адрес картинки первого доступного в
 *  точке блюда. Список собирает страница меню (src/routes/city-menu.tsx):
 *  только там известно, что точка продаёт и какие ширины есть у файла. */
export type SplashPhotos = Readonly<Record<string, string>>;

/** Чем играть заставку этой категории. */
export type SplashMode =
  | { kind: "video"; slug: string }
  | { kind: "photo"; src: string }
  | { kind: "none" };

/**
 * Режим заставки: сначала ролик, потом фото, потом ничего.
 *
 * Ролик важнее фото даже там, где есть и то и другое: в ролике блюдо
 * вращается, это и задумано как заставка. Фото — для категорий, где ролика
 * нет вовсе или где снятых блюд нет в меню этой точки.
 */
export function splashModeFor(
  categorySlug: string,
  available: ReadonlySet<string>,
  photos: SplashPhotos | undefined,
): SplashMode {
  const slug = splashVideoFor(categorySlug, available);
  if (slug) return { kind: "video", slug };
  const src = photos?.[categorySlug];
  if (src) return { kind: "photo", src };
  return { kind: "none" };
}
