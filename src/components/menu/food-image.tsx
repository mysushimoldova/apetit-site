// Фото блюда (DESIGN.md → Food Image): вырезка без фона прямо на Cream,
// высота 150px, под ней «лужица». Готовые WebP 400/800/1600 отдаёт
// src/lib/image-loader.ts. Нет фото → Sand-плитка с рисованной тарелкой
// (декоративная: название блюда стоит сразу под ней).
import Image from "next/image";
import images from "@/data/images.json";
import { IconPlate } from "@/components/icons/icon-plate";
import { productImageSrc } from "@/lib/product-image-src";

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

  if (!info || !photo) {
    return (
      <div className="flex h-(--size-food-tile) items-center justify-center rounded-input bg-sand text-ash">
        <IconPlate width={48} height={48} strokeWidth={1.2} />
      </div>
    );
  }

  return (
    <div className="food">
      <Image
        src={productImageSrc(photo, info.sizes)}
        alt={alt}
        width={info.width}
        height={info.height}
        sizes="(min-width: 1024px) 280px, 50vw"
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        className="h-full w-auto max-w-full object-contain"
      />
    </div>
  );
}
