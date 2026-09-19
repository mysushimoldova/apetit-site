// Фото блюда в плитке (DESIGN.md → Food Image). Ищет размеры готовых WebP
// в images.json и рисует FoodPicture. Только для серверных компонентов:
// в браузерный код images.json не попадает — там размеры берутся из каталога.
import images from "@/data/images.json";
import type { PhotoInfo } from "@/lib/cart/pricing";
import { FoodPicture } from "./food-picture";

type ImageInfo = { width: number; height: number; sizes: number[] };
const PRODUCT_IMAGES: Record<string, ImageInfo> = images.products;

export function FoodImage({
  photo,
  alt,
  eager = false,
}: {
  photo: string | null;
  alt: string;
  eager?: boolean;
}) {
  const info = photo ? PRODUCT_IMAGES[photo] : undefined;
  const picture: PhotoInfo | null =
    photo && info
      ? {
          slug: photo,
          width: info.width,
          height: info.height,
          sizes: info.sizes,
        }
      : null;
  return <FoodPicture photo={picture} alt={alt} eager={eager} />;
}
