// Подтверждение заказа — /[city]/comanda/[nr] и /ru/... (SPEC §8). Номер —
// число; содержимое рисует клиент из снимка ответа сервера. Страница
// личная — noindex.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderConfirmation } from "@/components/checkout/order-confirmation";
import { SiteFooter } from "@/components/menu/site-footer";
import { SiteHeader } from "@/components/menu/site-header";
import { getCity, isCitySlug, type Locale } from "@/data/points";
import { fill, getMessages } from "@/i18n/messages";
import { paths } from "@/i18n/routes";
import { pageMetadata } from "@/lib/seo";

export type ConfirmationParams = {
  params: Promise<{ city: string; nr: string }>;
};

function parse(city: string, nr: string) {
  if (!isCitySlug(city) || !/^[1-9]\d{3,8}$/.test(nr)) return null;
  return { city: getCity(city), number: Number(nr) };
}

export async function confirmationMetadata(
  locale: Locale,
  { params }: ConfirmationParams,
): Promise<Metadata> {
  const { city, nr } = await params;
  const parsed = parse(city, nr);
  if (!parsed) return {};
  const t = getMessages(locale);
  return pageMetadata({
    locale,
    path: paths.confirmation(parsed.city.slug, parsed.number),
    title: fill(t.meta.checkoutTitle, { city: parsed.city.name }),
    description: fill(t.meta.checkoutDescription, { city: parsed.city.name }),
    city: parsed.city.slug,
    noindex: true,
  });
}

export async function ConfirmationPage({
  locale,
  params,
}: ConfirmationParams & { locale: Locale }) {
  const { city: slug, nr } = await params;
  const parsed = parse(slug, nr);
  if (!parsed) notFound();
  const { city, number } = parsed;
  const t = getMessages(locale);
  return (
    <>
      <SiteHeader city={city} locale={locale} t={t} />
      <OrderConfirmation
        city={city.slug}
        number={number}
        locale={locale}
        t={t}
      />
      <SiteFooter locale={locale} t={t} />
    </>
  );
}
