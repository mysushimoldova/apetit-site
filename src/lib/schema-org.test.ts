import { describe, expect, it } from "vitest";
import { POINTS, getPoint } from "@/data/points";
import {
  breadcrumbSchema,
  organizationSchema,
  restaurantSchema,
  serializeJsonLd,
} from "./schema-org";

describe("Schema.org", () => {
  it("Restaurant: все поля из задания, телефон международный", () => {
    const point = getPoint("soroca-centru")!;
    const r = restaurantSchema(point, "ro");
    expect(r).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Restaurant",
      name: "Apetit Centru",
      telephone: "+37367578757",
      url: "https://apetit.md/soroca",
      hasMenu: "https://apetit.md/soroca",
      priceRange: "$",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Str. Independenței 72",
        addressLocality: "Soroca",
        addressCountry: "MD",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: 48.156795,
        longitude: 28.3036351,
      },
    });
    const hours = (r.openingHoursSpecification as Record<string, unknown>[])[0];
    expect(hours).toMatchObject({ opens: "08:30", closes: "23:00" });
    expect(hours.dayOfWeek).toHaveLength(7);
  });

  it("Restaurant на ru ссылается на русское меню", () => {
    const r = restaurantSchema(getPoint("otaci")!, "ru");
    expect(r.url).toBe("https://apetit.md/ru/otaci");
    expect(r.hasMenu).toBe("https://apetit.md/ru/otaci");
  });

  it("у каждой точки уникальный @id", () => {
    const ids = POINTS.map((p) => restaurantSchema(p, "ro")["@id"]);
    expect(new Set(ids).size).toBe(POINTS.length);
  });

  it("Organization: соцсети и адрес сайта", () => {
    expect(organizationSchema()).toMatchObject({
      "@type": "Organization",
      name: "Apetit",
      url: "https://apetit.md",
      sameAs: [
        "https://www.instagram.com/apetit.md/",
        "https://www.tiktok.com/@apetit.md",
      ],
    });
  });

  it("BreadcrumbList: позиции по порядку, адреса на языке", () => {
    const b = breadcrumbSchema("ru", [
      { name: "Apetit", path: "/" },
      { name: "Soroca", path: "/soroca" },
      { name: "Заказ", path: "/soroca/comanda" },
    ]);
    expect(b.itemListElement).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "Apetit",
        item: "https://apetit.md/ru",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Soroca",
        item: "https://apetit.md/ru/soroca",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Заказ",
        item: "https://apetit.md/ru/soroca/comanda",
      },
    ]);
  });

  it("сериализация экранирует «<»", () => {
    expect(serializeJsonLd({ a: "</script>" })).toBe('{"a":"\\u003c/script>"}');
    expect(JSON.parse(serializeJsonLd({ a: "</script>" }))).toEqual({
      a: "</script>",
    });
  });
});
