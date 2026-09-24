// Страница меню города (SPEC §3 шаги 2–4, DESIGN.md 2.2 → Layout) —
// /[city] и /ru/[city]. Шапка → лента чипов → для каждой категории:
// точечная линия, слово-вывеска, сетка плиток → подвал. Поверх — корзина
// (CartProvider): лист блюда, Cart Bar, лист корзины. В Сороках меню
// берётся по первой точке (выбор точки — при оформлении заказа).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CartProvider } from "@/components/cart/cart-provider";
import { RememberCity } from "@/components/city/remember-city";
import { CategoryChips } from "@/components/menu/category-chips";
import { ProductTile } from "@/components/menu/product-tile";
import { RevealGrid } from "@/components/menu/reveal-grid";
import { SiteFooter } from "@/components/menu/site-footer";
import { SiteHeader } from "@/components/menu/site-header";
import { MotionStage } from "@/components/motion/motion-stage";
import { JsonLd } from "@/components/seo/json-ld";
import { getMenuForCity } from "@/data/menu";
import {
  CITIES,
  getCity,
  isCitySlug,
  pointsOfCity,
  type Locale,
} from "@/data/points";
import { fill, getMessages } from "@/i18n/messages";
import { paths } from "@/i18n/routes";
import { billboardWidthEm } from "@/lib/billboard-fit";
import { buildCatalog } from "@/lib/cart/catalog";
import { breadcrumbSchema, restaurantSchema } from "@/lib/schema-org";
import { splashPhotosFor } from "@/lib/splash-photos";
import { pageMetadata } from "@/lib/seo";

export type CityParams = { params: Promise<{ city: string }> };

/** Все четыре города известны заранее — страницы статические. */
export function cityParams() {
  return CITIES.map((c) => ({ city: c.slug }));
}

export async function cityMenuMetadata(
  locale: Locale,
  { params }: CityParams,
): Promise<Metadata> {
  const { city: slug } = await params;
  if (!isCitySlug(slug)) return {};
  const city = getCity(slug);
  const t = getMessages(locale);
  return pageMetadata({
    locale,
    path: paths.city(city.slug),
    title: fill(t.meta.cityTitle, { city: city.name }),
    description: fill(t.meta.cityDescription, { city: city.name }),
    city: city.slug,
  });
}

/** Сколько первых фото грузить сразу и с высоким приоритетом. На телефоне
 *  390×844 в первый экран попадает один ряд — две плитки; остальные ждут
 *  своей очереди и не отбирают канал у шрифта слова-вывески (это LCP). */
const EAGER_TILES = 2;

export async function CityMenuPage({
  locale,
  params,
}: CityParams & { locale: Locale }) {
  const { city: slug } = await params;
  if (!isCitySlug(slug)) notFound();
  const city = getCity(slug);
  const t = getMessages(locale);
  const menu = getMenuForCity(city.slug);
  // Блюда города с ценами точки и разрешёнными добавками — для листа и корзины
  const catalog = buildCatalog(city.slug);
  const points = pointsOfCity(city.slug);
  // Часы — первой точки города (у всех 08:30–23:00; сервер проверит точку)
  const hours = points[0].hours;

  const chips = menu.map(({ category }) => ({
    slug: category.slug,
    label: category.name[locale],
    icon: category.icon,
  }));

  let tileIndex = 0;

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema(locale, [
            { name: "Apetit", path: paths.home() },
            { name: city.name, path: paths.city(city.slug) },
          ]),
          ...points.map((p) => restaurantSchema(p, locale)),
        ]}
      />
      {/* Блюда этого города: по слагам заставка выбирает ролик, а по
          адресам фото играет заставку у категорий, где ролика нет */}
      <MotionStage
        splashProducts={menu.flatMap((section) =>
          section.products.map((product) => product.slug),
        )}
        splashPhotos={splashPhotosFor(menu)}
      />
      <RememberCity slug={city.slug} />
      <CartProvider
        city={city.slug}
        locale={locale}
        t={t}
        catalog={catalog}
        hours={hours}
      >
        <SiteHeader city={city} locale={locale} t={t} cart />
        <CategoryChips items={chips} label={t.header.categories} />

        <main className="page menu-main pt-4">
          {/* Заголовок страницы для скринридеров: бренд + город, без нового текста */}
          <h1 className="sr-only" translate="no">
            Apetit {city.name}
          </h1>
          {menu.map(({ category, products }) => (
            <section
              key={category.slug}
              id={category.slug}
              aria-labelledby={`${category.slug}-title`}
              className="menu-section"
              // Ширина слова-вывески в em — CSS подгоняет размер под ширину
              style={
                {
                  "--billboard-em": billboardWidthEm(category.name[locale]),
                } as React.CSSProperties
              }
            >
              <h2 id={`${category.slug}-title`} className="billboard">
                {category.name[locale]}
              </h2>
              <RevealGrid className="tiles grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-12">
                {products.map((product) => (
                  <ProductTile
                    key={product.slug}
                    product={product}
                    locale={locale}
                    t={t}
                    eager={tileIndex++ < EAGER_TILES}
                  />
                ))}
              </RevealGrid>
            </section>
          ))}
        </main>
        <SiteFooter locale={locale} t={t} />
      </CartProvider>
    </>
  );
}
