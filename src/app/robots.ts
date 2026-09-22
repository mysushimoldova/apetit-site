// robots.txt (SPEC §8 → Поисковики): всё открыто, кроме админки, API,
// инструментов разработки и личных страниц заказа.
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site";
import { disallowedPaths } from "@/lib/sitemap";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: disallowedPaths() },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
