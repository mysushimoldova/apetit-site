import { describe, expect, it } from "vitest";
import { CITIES, POINTS, getCity, isCitySlug } from "./points";

describe("точки (SPEC 1.1)", () => {
  it("шесть точек", () => {
    expect(POINTS).toHaveLength(6);
  });

  it("пять городов в порядке SPEC", () => {
    expect(CITIES.map((c) => c.slug)).toEqual([
      "soroca",
      "sculeni",
      "floresti",
      "otaci",
      "briceni",
    ]);
  });

  it("slug городов уникальны и в нижнем регистре латиницей", () => {
    const slugs = CITIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z]+$/);
  });

  it("id и телефоны точек уникальны", () => {
    expect(new Set(POINTS.map((p) => p.id)).size).toBe(POINTS.length);
    expect(new Set(POINTS.map((p) => p.phone)).size).toBe(POINTS.length);
  });

  it("телефоны в формате 0XXXXXXXX", () => {
    for (const p of POINTS) expect(p.phone).toMatch(/^0\d{8}$/);
  });

  it("каждая точка ссылается на существующий город", () => {
    for (const p of POINTS) expect(isCitySlug(p.citySlug)).toBe(true);
  });

  it("в Сороках две точки, в остальных по одной", () => {
    const count = (slug: string) =>
      POINTS.filter((p) => p.citySlug === slug).length;
    expect(count("soroca")).toBe(2);
    for (const slug of ["sculeni", "floresti", "otaci", "briceni"]) {
      expect(count(slug)).toBe(1);
    }
  });

  it("Otaci — русский по умолчанию, остальные — румынский", () => {
    expect(getCity("otaci").locale).toBe("ru");
    for (const c of CITIES.filter((c) => c.slug !== "otaci")) {
      expect(c.locale).toBe("ro");
    }
  });

  it("все точки работают 08:30–23:00", () => {
    for (const p of POINTS) {
      expect(p.hours).toEqual({ open: "08:30", close: "23:00" });
    }
  });

  it("isCitySlug отвергает чужие значения", () => {
    expect(isCitySlug("chisinau")).toBe(false);
    expect(isCitySlug("Soroca")).toBe(false);
    expect(isCitySlug("")).toBe(false);
  });
});
