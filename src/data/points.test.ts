import { describe, expect, it } from "vitest";
import { CITIES, POINTS, getCity, isCitySlug } from "./points";

describe("точки (SPEC 1.1)", () => {
  it("пять точек (Florești закрылась)", () => {
    expect(POINTS).toHaveLength(5);
  });

  it("четыре города в порядке SPEC", () => {
    expect(CITIES.map((c) => c.slug)).toEqual([
      "soroca",
      "sculeni",
      "otaci",
      "briceni",
    ]);
    expect(isCitySlug("floresti")).toBe(false);
  });

  it("у каждой точки адрес и координаты в Молдове", () => {
    for (const p of POINTS) {
      expect(p.address.trim().length, p.id).toBeGreaterThan(0);
      expect(p.coords, p.id).not.toBeNull();
      // Молдова: широта 45.4–48.5, долгота 26.6–30.2
      expect(p.coords!.lat, p.id).toBeGreaterThan(45.4);
      expect(p.coords!.lat, p.id).toBeLessThan(48.5);
      expect(p.coords!.lng, p.id).toBeGreaterThan(26.6);
      expect(p.coords!.lng, p.id).toBeLessThan(30.2);
    }
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
    for (const slug of ["sculeni", "otaci", "briceni"]) {
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
