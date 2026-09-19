// Адрес фото блюда для next/image. Общий для сервера (страница меню) и
// загрузчика (src/lib/image-loader.ts, клиентский модуль): доступные ширины
// закодированы прямо в src («#w=400,800»), чтобы узкие картинки (бутылки,
// только 400) никогда не ссылались на несуществующие файлы.

export const PRODUCT_SRC = /^(\/img\/products\/[a-z0-9-]+)\.webp#w=([\d,]+)$/;

/** src для next/image: базовый путь + список доступных ширин. */
export function productImageSrc(
  slug: string,
  sizes: readonly number[],
): string {
  return `/img/products/${slug}.webp#w=${sizes.join(",")}`;
}
