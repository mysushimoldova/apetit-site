// Подтверждение заказа — /[city]/comanda/[nr] (SPEC §8). Номер — число;
// содержимое рисует клиент из снимка ответа сервера (базы ещё нет).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderConfirmation } from "@/components/checkout/order-confirmation";
import { SiteHeader } from "@/components/menu/site-header";
import { getCity, isCitySlug } from "@/data/points";
import { fill, getMessages } from "@/i18n/messages";

type Props = { params: Promise<{ city: string; nr: string }> };

function parse(city: string, nr: string) {
  if (!isCitySlug(city) || !/^[1-9]\d{3,8}$/.test(nr)) return null;
  return { city: getCity(city), number: Number(nr) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, nr } = await params;
  const parsed = parse(city, nr);
  if (!parsed) return {};
  const t = getMessages(parsed.city.locale);
  return {
    title: fill(t.meta.checkoutTitle, { city: parsed.city.name }),
    robots: { index: false },
  };
}

export default async function ConfirmationPage({ params }: Props) {
  const { city: slug, nr } = await params;
  const parsed = parse(slug, nr);
  if (!parsed) notFound();
  const { city, number } = parsed;
  const t = getMessages(city.locale);
  return (
    <div lang={city.locale}>
      <SiteHeader city={city} locale={city.locale} t={t} cart={false} />
      <OrderConfirmation
        city={city.slug}
        number={number}
        locale={city.locale}
        t={t}
      />
    </div>
  );
}
