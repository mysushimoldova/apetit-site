// Оформление заказа — /[city]/comanda и /ru/[city]/comanda (SPEC §3 шаг 5,
// §8). Сервер готовит точки города и каталоги точек (цены точки, без фото);
// форма и корзина — на клиенте (CheckoutView). Страница личная — noindex.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutView } from "@/components/checkout/checkout-view";
import type { PointView } from "@/components/checkout/point-picker";
import { SiteFooter } from "@/components/menu/site-footer";
import { SiteHeader } from "@/components/menu/site-header";
import { MotionStage } from "@/components/motion/motion-stage";
import { JsonLd } from "@/components/seo/json-ld";
import { PRODUCTS } from "@/data/menu";
import { getCity, isCitySlug, pointsOfCity, type Locale } from "@/data/points";
import { fill, getMessages } from "@/i18n/messages";
import { paths } from "@/i18n/routes";
import { buildPointCatalog } from "@/lib/cart/catalog";
import { buildClosedScript } from "@/lib/order/closed-script";
import { breadcrumbSchema } from "@/lib/schema-org";
import { pageMetadata } from "@/lib/seo";
import type { CityParams } from "./city-menu";

export async function checkoutMetadata(
  locale: Locale,
  { params }: CityParams,
): Promise<Metadata> {
  const { city: slug } = await params;
  if (!isCitySlug(slug)) return {};
  const city = getCity(slug);
  const t = getMessages(locale);
  return pageMetadata({
    locale,
    path: paths.checkout(city.slug),
    title: fill(t.meta.checkoutTitle, { city: city.name }),
    description: fill(t.meta.checkoutDescription, { city: city.name }),
    city: city.slug,
    noindex: true,
  });
}

export async function CheckoutPage({
  locale,
  params,
}: CityParams & { locale: Locale }) {
  const { city: slug } = await params;
  if (!isCitySlug(slug)) notFound();
  const city = getCity(slug);
  const t = getMessages(locale);

  const points = pointsOfCity(city.slug).filter((p) => p.acceptingOrders);
  // Все точки города на паузе — заказать нельзя, но сервер скажет это сам:
  // показываем все, чтобы страница не была пустой
  const shown = points.length > 0 ? points : pointsOfCity(city.slug);
  const views: PointView[] = shown.map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    phone: p.phone,
    hours: p.hours,
    coords: p.coords,
  }));
  const catalogs = Object.fromEntries(
    shown.map((p) => [p.id, buildPointCatalog(p.id, { photos: false })]),
  );

  const names = Object.fromEntries(PRODUCTS.map((p) => [p.slug, p.name]));

  return (
    <>
      <JsonLd
        data={breadcrumbSchema(locale, [
          { name: "Apetit", path: paths.home() },
          { name: city.name, path: paths.city(city.slug) },
          { name: t.checkout.title, path: paths.checkout(city.slug) },
        ])}
      />
      {/* Признак «сейчас закрыто» до первой отрисовки — чтобы баннер не
          выскочил после гидратации и не сдвинул страницу вниз (см.
          src/lib/order/closed-script.ts). Часы берём у первой точки: у всех
          точек Apetit они одинаковые (SPEC §1.1), а переключение точки уже
          после гидратации отработает React. Текст скрипта собран из наших
          же значений, пользовательских данных в нём нет. */}
      <script
        dangerouslySetInnerHTML={{
          __html: buildClosedScript(views[0].hours),
        }}
      />
      <MotionStage />
      <SiteHeader city={city} locale={locale} t={t} />
      <CheckoutView
        city={city.slug}
        locale={locale}
        t={t}
        points={views}
        catalogs={catalogs}
        names={names}
      />
      <SiteFooter locale={locale} t={t} />
    </>
  );
}
