import { describe, expect, it } from "vitest";
import { disallowedPaths, publicPages, publicPaths } from "./sitemap";

describe("sitemap и robots", () => {
  it("все страницы обоих языков: 4 города + главная + 3 страницы, ×2", () => {
    const pages = publicPages();
    expect(pages).toHaveLength(8 * 2);
    const urls = pages.map((p) => p.url);
    for (const path of [
      "",
      "/ru",
      "/soroca",
      "/ru/soroca",
      "/sculeni",
      "/otaci",
      "/ru/otaci",
      "/briceni",
      "/contacte",
      "/ru/contacte",
      "/confidentialitate",
      "/ru/confidentialitate",
      "/termeni",
      "/ru/termeni",
    ]) {
      expect(urls).toContain(`https://apetit.md${path}`);
    }
    expect(new Set(urls).size).toBe(urls.length);
    // Личных страниц нет
    expect(urls.some((u) => u.includes("/comanda"))).toBe(false);
  });

  it("у каждой страницы hreflang на обе версии", () => {
    const page = publicPages().find(
      (p) => p.url === "https://apetit.md/ru/otaci",
    );
    expect(page?.alternates?.languages).toEqual({
      ro: "https://apetit.md/otaci",
      ru: "https://apetit.md/ru/otaci",
    });
  });

  it("robots закрывает админку, API, dev и страницы заказа", () => {
    const d = disallowedPaths();
    expect(d).toContain("/admin");
    expect(d).toContain("/api/");
    expect(d).toContain("/dev/");
    expect(d).toContain("/soroca/comanda");
    expect(d).toContain("/ru/soroca/comanda");
    expect(publicPaths()).not.toContain("/admin");
  });
});
