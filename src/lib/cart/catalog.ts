// Каталог города для листа блюда и корзины. Собирается на сервере страницы
// (импортирует images.json — в клиентский бандл этот файл не должен попасть)
// и один раз передаётся в CartProvider.
import images from "@/data/images.json";
import { ADDONS, addonsFor, getMenuForCity } from "@/data/menu";
import type { CitySlug } from "@/data/points";
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

export function buildCatalog(citySlug: CitySlug): Catalog {
  const products: Record<string, CatalogProduct> = {};
  for (const section of getMenuForCity(citySlug)) {
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
        photo: photoInfo(p.photo),
      };
    }
  }
  return {
    products,
    addons: Object.fromEntries(ADDONS.map((a) => [a.id, a])),
  };
}
