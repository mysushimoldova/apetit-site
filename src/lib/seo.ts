// Метаданные страниц (SPEC §8 → Поисковики): уникальные title и
// description на каждый язык, canonical, hreflang ro ↔ ru (x-default → ro),
// Open Graph и Twitter-карточка. Одна функция — все страницы собирают
// метаданные одинаково; адреса — из src/i18n/routes.ts.
import type { Metadata } from "next";
import { SITE_URL, absoluteUrl } from "@/config/site";
import type { CitySlug, Locale } from "@/data/points";
import { DEFAULT_LOCALE } from "@/i18n/messages";
import { LOCALES, localePath } from "@/i18n/routes";

/** Картинка 1200×630 для соцсетей: общая или города (scripts/og-images.mjs). */
export function ogImagePath(city?: CitySlug): string {
  return `/og/${city ?? "apetit"}.png`;
}

export const OG_IMAGE = { width: 1200, height: 630 } as const;

export function pageMetadata({
  locale,
  path,
  title,
  description,
  city,
  noindex = false,
}: {
  locale: Locale;
  /** Путь без языка: «/soroca», «/contacte» */
  path: string;
  title: string;
  description: string;
  /** Картинка города вместо общей */
  city?: CitySlug;
  /** Личные страницы (оформление, подтверждение) — не для поисковиков */
  noindex?: boolean;
}): Metadata {
  const canonical = absoluteUrl(localePath(locale, path));
  const languages = Object.fromEntries(
    LOCALES.map((code) => [code, absoluteUrl(localePath(code, path))]),
  );
  languages["x-default"] = absoluteUrl(localePath(DEFAULT_LOCALE, path));
  const image = ogImagePath(city);

  return {
    title,
    description,
    alternates: { canonical, languages },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      siteName: "Apetit",
      locale: locale === "ro" ? "ro_RO" : "ru_RU",
      url: canonical,
      title,
      description,
      images: [{ url: image, ...OG_IMAGE, alt: "Apetit" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

/** Общие метаданные корневого layout: база адресов для относительных путей. */
export function rootMetadata(): Metadata {
  return { metadataBase: new URL(SITE_URL) };
}
