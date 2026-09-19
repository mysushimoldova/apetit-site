// Страница меню города (SPEC §3 шаги 2–4, DESIGN.md 2.2 → Layout).
// Шапка → лента чипов → для каждой категории: точечная линия, слово-вывеска,
// сетка плиток. Поверх — корзина (CartProvider): лист блюда, Cart Bar,
// лист корзины. В Сороках меню берётся по первой точке (выбор точки — при
// оформлении заказа).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CartProvider } from "@/components/cart/cart-provider";
import { RememberCity } from "@/components/city/remember-city";
import { CategoryChips } from "@/components/menu/category-chips";
import { ProductTile } from "@/components/menu/product-tile";
import { RevealGrid } from "@/components/menu/reveal-grid";
import { SiteHeader } from "@/components/menu/site-header";
import { getMenuForCity } from "@/data/menu";
import { CITIES, getCity, isCitySlug } from "@/data/points";
import { fill, getMessages } from "@/i18n/messages";
import { billboardWidthEm } from "@/lib/billboard-fit";
import { buildCatalog } from "@/lib/cart/catalog";

type Props = { params: Promise<{ city: string }> };

// Все пять городов известны заранее — страницы статические.
export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }));
}

// Любой другой slug → 404, а не попытка отрендерить.
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug } = await params;
  if (!isCitySlug(slug)) return {};
  const city = getCity(slug);
  const t = getMessages(city.locale);
  return { title: fill(t.meta.cityTitle, { city: city.name }) };
}

/** Сколько первых фото грузить сразу (первый экран: 2 колонки × 2 ряда). */
const EAGER_TILES = 4;

export default async function CityPage({ params }: Props) {
  const { city: slug } = await params;
  if (!isCitySlug(slug)) notFound();
  const city = getCity(slug);
  // Otaci открывается на русском (SPEC §7); остальные — на румынском
  const locale = city.locale;
  const t = getMessages(locale);
  const menu = getMenuForCity(city.slug);
  // Блюда города с ценами точки и разрешёнными добавками — для листа и корзины
  const catalog = buildCatalog(city.slug);

  const chips = menu.map(({ category }) => ({
    slug: category.slug,
    label: category.name[locale],
    icon: category.icon,
  }));

  let tileIndex = 0;

  return (
    <div lang={locale}>
      <RememberCity slug={city.slug} />
      <CartProvider city={city.slug} locale={locale} t={t} catalog={catalog}>
        <SiteHeader city={city} locale={locale} t={t} />
        <CategoryChips items={chips} label={t.header.categories} />

        <main className="page pt-4">
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
      </CartProvider>
    </div>
  );
}
