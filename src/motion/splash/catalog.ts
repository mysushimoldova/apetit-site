// Какие ролики играют на заставке категории (docs/motion/splash-prompt.md).
//
// Слаг ролика = слаг блюда = имя файла в public/splash. Ролик показывается,
// только если это блюдо на самом деле продаётся в выбранной точке: заставка
// не обещает того, чего в меню нет. Категории, которых здесь нет (menu,
// crispy, hot-dog, pizza, cartofi и любые будущие), заставки не имеют —
// переход к ним обычный, без ошибок в консоли.
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
 * пустой список, и заставки не будет.
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
