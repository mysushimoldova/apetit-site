// Schema.org для поисковиков (SPEC §8): Restaurant на каждую точку,
// BreadcrumbList на меню и оформлении, Organization на главной.
// Только данные из src/data — ничего выдуманного.
import { absoluteUrl } from "@/config/site";
import { COMPANY } from "@/data/company";
import { getCity, type Locale, type Point } from "@/data/points";
import { localePath, paths } from "@/i18n/routes";
import { normalizePhone } from "@/lib/order/phone";
import { ogImagePath } from "./seo";

const SCHEMA = "https://schema.org";
const WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export type JsonLd = Record<string, unknown>;

/** Точка как Restaurant: название, адрес, координаты, телефон, часы,
 *  ценовая категория, ссылка на меню города. */
export function restaurantSchema(point: Point, locale: Locale): JsonLd {
  const city = getCity(point.citySlug);
  const menuUrl = absoluteUrl(localePath(locale, paths.city(city.slug)));
  return {
    "@context": SCHEMA,
    "@type": "Restaurant",
    "@id": `${absoluteUrl(paths.contacts())}#${point.id}`,
    name: point.name,
    url: menuUrl,
    image: absoluteUrl(ogImagePath(city.slug)),
    telephone: normalizePhone(point.phone) ?? point.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: point.address,
      addressLocality: city.name,
      addressCountry: "MD",
    },
    ...(point.coords && {
      geo: {
        "@type": "GeoCoordinates",
        latitude: point.coords.lat,
        longitude: point.coords.lng,
      },
    }),
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: WEEK,
        opens: point.hours.open,
        closes: point.hours.close,
      },
    ],
    servesCuisine: "Fast food",
    priceRange: "$",
    hasMenu: menuUrl,
    parentOrganization: { "@id": organizationId() },
  };
}

function organizationId(): string {
  return `${absoluteUrl("/")}#organization`;
}

/** Компания — на экране городов. */
export function organizationSchema(): JsonLd {
  return {
    "@context": SCHEMA,
    "@type": "Organization",
    "@id": organizationId(),
    name: "Apetit",
    legalName: COMPANY.name,
    url: absoluteUrl("/"),
    image: absoluteUrl(ogImagePath()),
    email: COMPANY.email,
    sameAs: [COMPANY.social.instagram, COMPANY.social.tiktok],
  };
}

export interface Crumb {
  name: string;
  /** Путь без языка */
  path: string;
}

/** Хлебные крошки: Apetit → город → (Comandă). */
export function breadcrumbSchema(locale: Locale, crumbs: Crumb[]): JsonLd {
  return {
    "@context": SCHEMA,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(localePath(locale, crumb.path)),
    })),
  };
}

/** JSON для <script type="application/ld+json">: «<» экранируется, чтобы
 *  текст не мог закрыть тег. Данные статические, но правило — правило. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
