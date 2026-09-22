import { describe, expect, it } from "vitest";
import { ogImagePath, pageMetadata, rootMetadata } from "./seo";

describe("метаданные страниц", () => {
  it("canonical и hreflang: ro без префикса, ru с /ru, x-default → ro", () => {
    const m = pageMetadata({
      locale: "ru",
      path: "/soroca",
      title: "T",
      description: "D",
      city: "soroca",
    });
    expect(m.alternates).toEqual({
      canonical: "https://apetit.md/ru/soroca",
      languages: {
        ro: "https://apetit.md/soroca",
        ru: "https://apetit.md/ru/soroca",
        "x-default": "https://apetit.md/soroca",
      },
    });
  });

  it("главная: «/» и «/ru» без хвостовой косой черты", () => {
    const m = pageMetadata({
      locale: "ro",
      path: "/",
      title: "T",
      description: "D",
    });
    expect(m.alternates?.canonical).toBe("https://apetit.md");
    expect(m.alternates?.languages).toMatchObject({
      ru: "https://apetit.md/ru",
    });
  });

  it("Open Graph и Twitter: картинка города или общая", () => {
    const city = pageMetadata({
      locale: "ro",
      path: "/otaci",
      title: "T",
      description: "D",
      city: "otaci",
    });
    expect(city.openGraph).toMatchObject({
      url: "https://apetit.md/otaci",
      locale: "ro_RO",
      images: [{ url: "/og/otaci.png", width: 1200, height: 630 }],
    });
    expect(city.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["/og/otaci.png"],
    });
    const general = pageMetadata({
      locale: "ru",
      path: "/contacte",
      title: "T",
      description: "D",
    });
    expect(general.openGraph).toMatchObject({
      locale: "ru_RU",
      images: [{ url: "/og/apetit.png" }],
    });
  });

  it("личные страницы — noindex, остальные без robots", () => {
    const priv = pageMetadata({
      locale: "ro",
      path: "/soroca/comanda",
      title: "T",
      description: "D",
      noindex: true,
    });
    expect(priv.robots).toEqual({ index: false, follow: false });
    const pub = pageMetadata({
      locale: "ro",
      path: "/soroca",
      title: "T",
      description: "D",
    });
    expect(pub.robots).toBeUndefined();
  });

  it("картинки и база адресов", () => {
    expect(ogImagePath()).toBe("/og/apetit.png");
    expect(ogImagePath("briceni")).toBe("/og/briceni.png");
    expect(String(rootMetadata().metadataBase)).toBe("https://apetit.md/");
  });
});
