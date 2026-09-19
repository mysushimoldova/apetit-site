import { describe, expect, it } from "vitest";
import imageLoader from "./image-loader";
import { productImageSrc } from "./product-image-src";

describe("загрузчик картинок next/image", () => {
  it("productImageSrc кодирует доступные ширины в src", () => {
    expect(productImageSrc("kebab-cheese", [400, 800, 1600])).toBe(
      "/img/products/kebab-cheese.webp#w=400,800,1600",
    );
  });

  it("выбирает самый большой доступный размер, не превышающий запрошенный", () => {
    const src = "/img/products/kebab-cheese.webp#w=400,800,1600";
    expect(imageLoader({ src, width: 400 })).toBe(
      "/img/products/kebab-cheese-400.webp",
    );
    expect(imageLoader({ src, width: 1000 })).toBe(
      "/img/products/kebab-cheese-800.webp",
    );
    expect(imageLoader({ src, width: 1600 })).toBe(
      "/img/products/kebab-cheese-1600.webp",
    );
    expect(imageLoader({ src, width: 3000 })).toBe(
      "/img/products/kebab-cheese-1600.webp",
    );
  });

  it("узкая картинка (только 400) никогда не ссылается на несуществующие файлы", () => {
    const src = "/img/products/cola.webp#w=400";
    expect(imageLoader({ src, width: 800 })).toBe(
      "/img/products/cola-400.webp",
    );
    expect(imageLoader({ src, width: 1600 })).toBe(
      "/img/products/cola-400.webp",
    );
  });

  it("запрошенная ширина меньше минимальной → минимальная", () => {
    const src = "/img/products/cola.webp#w=400,800";
    expect(imageLoader({ src, width: 200 })).toBe(
      "/img/products/cola-400.webp",
    );
  });

  it("src без маркера — отдаётся как есть", () => {
    expect(imageLoader({ src: "/logo.svg", width: 100 })).toBe("/logo.svg");
  });
});
