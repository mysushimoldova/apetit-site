// Каталог города для листа блюда и корзины. Собирается на сервере страницы
// (импортирует images.json — в клиентский бандл этот файл не должен попасть)
// и один раз передаётся в CartProvider.
import images from "@/data/images.json";
import { ADDONS, addonsFor, getMenuForPoint } from "@/data/menu";
import { pointsOfCity, type CitySlug } from "@/data/points";
import type { Catalog, CatalogProduct, PhotoInfo } from "./pricing";

type ImageInfo = { width: number; height: number; sizes: number[] };
const PRODUCT_IMAGES: Record<string, ImageInfo> = images.products;

function photoInfo(photo: string | null): PhotoInfo | null {
  const info = photo ? PRODUCT_IMAGES[photo] : undefined;
  if (!photo || !info) return null;
  return {
    slug: photo,
    width: info.width,
    height: info.height,
    sizes: info.sizes,
  };
}

/**
 * Каталог точки: включённые блюда по ценам этой точки. photos: false — без
 * размеров фото (сервер заказа и итог на странице оформления).
 */
export function buildPointCatalog(
  pointId: string,
  { photos = true }: { photos?: boolean } = {},
): Catalog {
  const products: Record<string, CatalogProduct> = {};
  for (const section of getMenuForPoint(pointId)) {
    for (const p of section.products) {
      products[p.slug] = {
        slug: p.slug,
        category: p.category,
        name: p.name,
        ingredients: p.ingredients,
        grams: p.grams,
        price: p.price,
        variants: p.variants,
        removable: p.removable,
        addonIds: addonsFor(p).map((a) => a.id),
        photo: photos ? photoInfo(p.photo) : null,
      };
    }
  }
  return {
    products,
    addons: Object.fromEntries(ADDONS.map((a) => [a.id, a])),
  };
}

/** Каталог города для меню — по первой точке (как getMenuForCity). */
export function buildCatalog(citySlug: CitySlug): Catalog {
  const [first] = pointsOfCity(citySlug);
  if (!first) throw new Error(`No points for city ${citySlug}`);
  return buildPointCatalog(first.id);
}
