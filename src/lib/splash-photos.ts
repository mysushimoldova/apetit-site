// Фото для заставки категорий без ролика: слаг категории → адрес картинки.
//
// Только для серверных компонентов: импортирует images.json, а этот файл в
// браузерный бандл попадать не должен (так же устроен src/components/menu/
// food-image.tsx). Страница меню считает список один раз и отдаёт готовым —
// движок заставки про меню и про размеры файлов ничего не знает.
//
// Берётся ПЕРВОЕ блюдо категории, у которого есть фото, в том же порядке,
// в котором блюда стоят в меню точки: заставка показывает то, что человек
// увидит первым, прокрутив к категории.
import images from "@/data/images.json";
import type { MenuSection } from "@/data/menu";

type ImageInfo = { width: number; height: number; sizes: number[] };
const PRODUCT_IMAGES: Record<string, ImageInfo> = images.products;

/** Какую ширину файла просить. Блюдо на заставке не шире 320 px CSS
 *  (MAX_VIDEO_WIDTH в src/motion/splash/geometry.ts); при плотности экрана
 *  2–3 это 640…960 настоящих пикселей — 800 в самый раз. Нет такого
 *  размера — берём самый крупный из имеющихся. */
const WANT = 800;

function bestSize(sizes: readonly number[]): number {
  const fitting = sizes.filter((size) => size <= WANT);
  return fitting.length > 0 ? Math.max(...fitting) : Math.min(...sizes);
}

/** Слаг категории → адрес фото. Категории без фото в список не попадают. */
export function splashPhotosFor(
  menu: readonly MenuSection[],
): Record<string, string> {
  const photos: Record<string, string> = {};
  for (const section of menu) {
    for (const product of section.products) {
      const info = product.photo ? PRODUCT_IMAGES[product.photo] : undefined;
      if (!info || info.sizes.length === 0) continue;
      photos[section.category.slug] =
        `/img/products/${product.photo}-${bestSize(info.sizes)}.webp`;
      break;
    }
  }
  return photos;
}
