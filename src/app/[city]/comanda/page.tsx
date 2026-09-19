// Оформление заказа — /[city]/comanda (SPEC §3 шаг 5, §8). Язык — города
// (Otaci — ru). Сервер готовит точки города и каталоги точек (цены точки,
// без фото); форма и корзина — на клиенте (CheckoutView).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutView } from "@/components/checkout/checkout-view";
import type { PointView } from "@/components/checkout/point-picker";
import { SiteHeader } from "@/components/menu/site-header";
import { PRODUCTS } from "@/data/menu";
import { CITIES, getCity, isCitySlug, pointsOfCity } from "@/data/points";
import { fill, getMessages } from "@/i18n/messages";
import { buildPointCatalog } from "@/lib/cart/catalog";

type Props = { params: Promise<{ city: string }> };

export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug } = await params;
  if (!isCitySlug(slug)) return {};
  const city = getCity(slug);
  const t = getMessages(city.locale);
  return {
    title: fill(t.meta.checkoutTitle, { city: city.name }),
    // Страница личного заказа — не для поисковиков
    robots: { index: false },
  };
}

export default async function CheckoutPage({ params }: Props) {
  const { city: slug } = await params;
  if (!isCitySlug(slug)) notFound();
  const city = getCity(slug);
  const locale = city.locale;
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
    <div lang={locale}>
      <SiteHeader city={city} locale={locale} t={t} cart={false} />
      <CheckoutView
        city={city.slug}
        locale={locale}
        t={t}
        points={views}
        catalogs={catalogs}
        names={names}
      />
    </div>
  );
}
