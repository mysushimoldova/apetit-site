"use client";
// Глобальный загрузчик для next/image (next.config.ts → images.loaderFile).
// Фото блюд лежат готовыми в трёх ширинах
// (public/img/products/<slug>-400|800|1600.webp), оптимизатор Next не нужен.
// Выбираем самую большую доступную ширину, не больше запрошенной.
// Остальные src отдаются как есть.
import type { ImageLoaderProps } from "next/image";
import { PRODUCT_SRC } from "./product-image-src";

export default function imageLoader({ src, width }: ImageLoaderProps): string {
  const match = PRODUCT_SRC.exec(src);
  if (!match) return src;
  const [, base, list] = match;
  const sizes = list
    .split(",")
    .map(Number)
    .sort((a, b) => a - b);
  const fitting = sizes.filter((s) => s <= width);
  const chosen = fitting.length ? fitting[fitting.length - 1] : sizes[0];
  return `${base}-${chosen}.webp`;
}
