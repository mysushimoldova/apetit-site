import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/data/menu/categories";
import { PRODUCTS } from "@/data/menu/products";
import {
  SPLASH_VIDEOS,
  splashModeFor,
  splashVideoSrc,
  splashVideosFor,
} from "./catalog";

const ALL = new Set(Object.values(SPLASH_VIDEOS).flat());

describe("выбор роликов заставки", () => {
  it("оба блюда есть в точке — берётся столько, сколько просят", () => {
    expect(splashVideosFor("kebab", ALL, 2)).toEqual([
      "kebab-xl-xxl",
      "kebab-cheese",
    ]);
    expect(splashVideosFor("kebab", ALL, 1)).toEqual(["kebab-xl-xxl"]);
  });

  it("первого блюда в точке нет — играет второе", () => {
    const only = new Set(["kebab-cheese"]);
    expect(splashVideosFor("kebab", only, 1)).toEqual(["kebab-cheese"]);
  });

  it("ни одного блюда категории в точке нет — заставки нет", () => {
    expect(splashVideosFor("kebab", new Set(), 1)).toEqual([]);
  });

  it("у категории нет роликов — список пустой (дальше в ход идёт фото)", () => {
    for (const slug of ["menu", "crispy", "hot-dog", "pizza", "cartofi"]) {
      expect(splashVideosFor(slug, ALL, 2)).toEqual([]);
    }
  });

  it("count меньше единицы всё равно даёт одно блюдо", () => {
    expect(splashVideosFor("drinks", ALL, 0)).toEqual(["cola"]);
  });

  it("адрес ролика — файл из public/splash", () => {
    expect(splashVideoSrc("cola")).toBe("/splash/cola.mp4");
  });
});

describe("режим заставки: видео / фото / ничего", () => {
  const PHOTOS = {
    pizza: "/img/products/pizza-margarita-800.webp",
    kebab: "/img/products/kebab-cheese-800.webp",
  };

  it("есть ролики — играет ролик, даже если фото тоже есть", () => {
    expect(splashModeFor("kebab", ALL, 2, PHOTOS)).toEqual({
      kind: "video",
      slugs: ["kebab-xl-xxl", "kebab-cheese"],
    });
  });

  it("роликов у категории нет — играет фото", () => {
    expect(splashModeFor("pizza", ALL, 1, PHOTOS)).toEqual({
      kind: "photo",
      src: PHOTOS.pizza,
    });
  });

  it("ролики есть, но этих блюд нет в точке — тоже фото", () => {
    expect(splashModeFor("kebab", new Set(), 1, PHOTOS)).toEqual({
      kind: "photo",
      src: PHOTOS.kebab,
    });
  });

  it("ни ролика, ни фото — заставки нет", () => {
    expect(splashModeFor("hot-dog", ALL, 1, PHOTOS)).toEqual({ kind: "none" });
    expect(splashModeFor("pizza", ALL, 1, undefined)).toEqual({ kind: "none" });
  });
});

describe("список роликов сходится с меню", () => {
  it("каждый ролик — настоящее блюдо своей категории", () => {
    for (const [category, slugs] of Object.entries(SPLASH_VIDEOS)) {
      for (const slug of slugs) {
        const product = PRODUCTS.find((p) => p.slug === slug);
        expect(product, `${slug}: нет такого блюда`).toBeTruthy();
        expect(product?.category, `${slug}: чужая категория`).toBe(category);
      }
    }
  });

  it("каждая категория с роликами есть в меню", () => {
    const known = new Set<string>(CATEGORIES.map((c) => c.slug));
    for (const category of Object.keys(SPLASH_VIDEOS)) {
      expect(known.has(category), `${category}: нет такой категории`).toBe(
        true,
      );
    }
  });
});
