// Адрес сайта — для canonical, hreflang, sitemap, Open Graph и Schema.org.
// Домен куплен (SPEC §1); на предпросмотрах ссылки всё равно ведут на
// боевой адрес — так и должно быть для поисковиков.
export const SITE_URL = "https://apetit.md";

/** Полный адрес страницы: «/ru/soroca» → «https://apetit.md/ru/soroca». */
export function absoluteUrl(path: string): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}
