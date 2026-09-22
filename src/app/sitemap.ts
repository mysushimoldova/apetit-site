// sitemap.xml (SPEC §8 → Поисковики): все публичные страницы на обоих
// языках, у каждой — hreflang-альтернативы. Оформление и подтверждение —
// личные страницы, их здесь нет (и они noindex).
import type { MetadataRoute } from "next";
import { publicPages } from "@/lib/sitemap";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPages();
}
