import { describe, expect, it } from "vitest";
import type { City } from "@/data/points";
import {
  cityTileLocale,
  isLocale,
  localePath,
  parseLocalePath,
  paths,
  switchLocalePath,
} from "./routes";

describe("адреса на двух языках", () => {
  it("ro — без префикса, ru — с /ru", () => {
    expect(localePath("ro", "/soroca")).toBe("/soroca");
    expect(localePath("ru", "/soroca")).toBe("/ru/soroca");
    expect(localePath("ru", "/soroca/comanda")).toBe("/ru/soroca/comanda");
  });

  it("главная: «/» и «/ru» (без хвостовой косой черты)", () => {
    expect(localePath("ro", "/")).toBe("/");
    expect(localePath("ru", "/")).toBe("/ru");
  });

  it("путь без начальной косой черты — ошибка программиста", () => {
    expect(() => localePath("ro", "soroca")).toThrow();
  });

  it("разбор адреса из браузера", () => {
    expect(parseLocalePath("/")).toEqual({ locale: "ro", path: "/" });
    expect(parseLocalePath("/ru")).toEqual({ locale: "ru", path: "/" });
    expect(parseLocalePath("/ru/otaci")).toEqual({
      locale: "ru",
      path: "/otaci",
    });
    expect(parseLocalePath("/termeni")).toEqual({
      locale: "ro",
      path: "/termeni",
    });
    // «/rusia» — не русский префикс
    expect(parseLocalePath("/rusia")).toEqual({ locale: "ro", path: "/rusia" });
  });

  it("лишние косые черты в начале не дают ссылку на чужой сайт", () => {
    expect(switchLocalePath("//evil.com", "ru")).toBe("/ru/evil.com");
    expect(switchLocalePath("/ru//evil.com", "ro")).toBe("/evil.com");
    expect(parseLocalePath("")).toEqual({ locale: "ro", path: "/" });
  });

  it("переключатель ведёт на тот же экран", () => {
    expect(switchLocalePath("/soroca/comanda", "ru")).toBe(
      "/ru/soroca/comanda",
    );
    expect(switchLocalePath("/ru/soroca/comanda/1042", "ro")).toBe(
      "/soroca/comanda/1042",
    );
    expect(switchLocalePath("/ru/contacte", "ro")).toBe("/contacte");
    expect(switchLocalePath("/", "ru")).toBe("/ru");
    expect(switchLocalePath("/ru", "ro")).toBe("/");
    // Тот же язык — тот же адрес
    expect(switchLocalePath("/ru/otaci", "ru")).toBe("/ru/otaci");
  });

  it("пути страниц", () => {
    expect(paths.city("otaci")).toBe("/otaci");
    expect(paths.checkout("soroca")).toBe("/soroca/comanda");
    expect(paths.confirmation("soroca", 1042)).toBe("/soroca/comanda/1042");
    expect(paths.contacts()).toBe("/contacte");
    expect(paths.privacy()).toBe("/confidentialitate");
    expect(paths.terms()).toBe("/termeni");
  });

  it("isLocale", () => {
    expect(isLocale("ro")).toBe(true);
    expect(isLocale("ru")).toBe(true);
    expect(isLocale("en")).toBe(false);
  });
});

describe("язык плитки города", () => {
  const otaci: City = { slug: "otaci", name: "Otaci", locale: "ru" };
  const soroca: City = { slug: "soroca", name: "Soroca", locale: "ro" };

  it("без выбора — язык города", () => {
    expect(cityTileLocale("ro", otaci, null)).toBe("ru");
    expect(cityTileLocale("ro", soroca, null)).toBe("ro");
  });

  it("выбор посетителя важнее языка города", () => {
    expect(cityTileLocale("ro", otaci, "ro")).toBe("ro");
    expect(cityTileLocale("ro", soroca, "ru")).toBe("ru");
  });

  it("на «/ru» — всегда русский", () => {
    expect(cityTileLocale("ru", soroca, "ro")).toBe("ru");
  });
});
