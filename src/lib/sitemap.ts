// Список публичных страниц для sitemap.xml и запреты для robots.txt —
// чистые функции, проверяются тестом. Адреса — из src/i18n/routes.ts.
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/config/site";
import { CITIES } from "@/data/points";
import { LOCALES, localePath, paths } from "@/i18n/routes";

/** Пути без языка — по одному на страницу. */
export function publicPaths(): string[] {
  return [
    paths.home(),
    ...CITIES.map((c) => paths.city(c.slug)),
    paths.contacts(),
    paths.privacy(),
    paths.terms(),
  ];
}

export function publicPages(): MetadataRoute.Sitemap {
  return publicPaths().flatMap((path) =>
    LOCALES.map((locale) => ({
      url: absoluteUrl(localePath(locale, path)),
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((code) => [code, absoluteUrl(localePath(code, path))]),
        ),
      },
    })),
  );
}

/** Что закрыть от индексации: админка (SPEC §8), API, dev, страницы заказа. */
export function disallowedPaths(): string[] {
  return [
    "/admin",
    "/api/",
    "/dev/",
    ...LOCALES.flatMap((locale) =>
      CITIES.map((c) => localePath(locale, paths.checkout(c.slug))),
    ),
  ];
}
