import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/data/menu/categories";
import { PRODUCTS } from "@/data/menu/products";
import {
  SPLASH_VIDEOS,
  splashModeFor,
  splashVideoSrc,
  splashVideoFor,
} from "./catalog";

const ALL = new Set(Object.values(SPLASH_VIDEOS).flat());

describe("выбор блюда заставки", () => {
  // Решение хозяина 24.09.2026: на заставке всегда ОДНО блюдо — первое,
  // какое есть в меню выбранной точки.
  it("оба блюда есть в точке — играет первое", () => {
    expect(splashVideoFor("kebab", ALL)).toBe("kebab-xl-xxl");
    expect(splashVideoFor("drinks", ALL)).toBe("cola");
  });

  it("первого блюда в точке нет — играет второе", () => {
    expect(splashVideoFor("kebab", new Set(["kebab-cheese"]))).toBe(
      "kebab-cheese",
    );
  });

  it("ни одного блюда категории в точке нет — ролика нет", () => {
    expect(splashVideoFor("kebab", new Set())).toBe(null);
  });

  it("у категории нет роликов — ролика нет (дальше в ход идёт фото)", () => {
    for (const slug of ["menu", "crispy", "hot-dog", "pizza", "cartofi"]) {
      expect(splashVideoFor(slug, ALL)).toBe(null);
    }
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

  it("есть ролик — играет ролик, даже если фото тоже есть", () => {
    expect(splashModeFor("kebab", ALL, PHOTOS)).toEqual({
      kind: "video",
      slug: "kebab-xl-xxl",
    });
  });

  it("ролика у категории нет — играет фото", () => {
    expect(splashModeFor("pizza", ALL, PHOTOS)).toEqual({
      kind: "photo",
      src: PHOTOS.pizza,
    });
  });

  it("ролики есть, но этих блюд нет в точке — тоже фото", () => {
    expect(splashModeFor("kebab", new Set(), PHOTOS)).toEqual({
      kind: "photo",
      src: PHOTOS.kebab,
    });
  });

  it("ни ролика, ни фото — заставки нет", () => {
    expect(splashModeFor("hot-dog", ALL, PHOTOS)).toEqual({ kind: "none" });
    expect(splashModeFor("pizza", ALL, undefined)).toEqual({ kind: "none" });
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
