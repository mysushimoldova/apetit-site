// Фото блюда без поиска в images.json: размеры приходят готовыми (PhotoInfo).
// Работает и на сервере (плитка), и в браузере (лист блюда, корзина), не таща
// images.json в клиентский бандл. DESIGN.md → Food Image: вырезка прямо на
// фоне, под ней «лужица»; нет фото → Sand-плитка с рисованной тарелкой.
import Image from "next/image";
import { IconPlate } from "@/components/icons/icon-plate";
import type { PhotoInfo } from "@/lib/cart/pricing";
import { productImageSrc } from "@/lib/product-image-src";

/** Высота фото: 150px в плитке, 280px в листе, 56px в строке корзины. */
const HEIGHT = { tile: 150, sheet: 280, thumb: 56 } as const;
type Size = keyof typeof HEIGHT;

const BOX: Record<Size, string> = {
  tile: "",
  sheet: "[--food-h:var(--size-food-sheet)]",
  thumb: "[--food-h:56px]",
};

export function FoodPicture({
  photo,
  alt,
  size = "tile",
  eager = false,
}: {
  photo: PhotoInfo | null;
  alt: string;
  size?: Size;
  eager?: boolean;
}) {
  if (!photo) {
    const icon = size === "thumb" ? 28 : size === "sheet" ? 72 : 48;
    return (
      <div
        className={`flex h-[var(--food-h,var(--size-food-tile))] items-center justify-center rounded-input bg-sand text-ash ${BOX[size]}`}
      >
        <IconPlate width={icon} height={icon} strokeWidth={1.2} />
      </div>
    );
  }

  // В плитке ширина — колонка сетки: половина экрана минус поля 16px и
  // половина зазора 16px (на 390px ≈ 171px); на десктопе ≤ 280px. В листе и
  // корзине фото ограничено высотой, поэтому ширина = высота × пропорции.
  // Браузер сам выберет 400/800/1600 по этой ширине и плотности экрана.
  const sizes =
    size === "tile"
      ? "(min-width: 1024px) 280px, calc(50vw - 24px)"
      : `${Math.round((HEIGHT[size] * photo.width) / photo.height)}px`;

  return (
    <div className={`food ${BOX[size]}`}>
      <Image
        src={productImageSrc(photo.slug, photo.sizes)}
        alt={alt}
        width={photo.width}
        height={photo.height}
        sizes={sizes}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager && size === "tile" ? "high" : undefined}
        className="h-full w-auto max-w-full object-contain"
      />
    </div>
  );
}
