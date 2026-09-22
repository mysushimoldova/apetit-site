// Страница контактов — /contacte и /ru/contacte (SPEC §8). Заголовок Oswald,
// строка часов, карточка на каждую точку (DESIGN.md → Point Card): название,
// адрес, телефон (tel:), «Comandă» → меню города (Primary), «Vezi pe
// hartă» и «Lasă o recenzie» — текстовые ссылки на Google по Place ID.
// Соцсети — только в подвале (решение архитектора). Ни форм, ни виджетов
// карт (SPEC §6.5).
// Порядок точек — как в src/data/points.ts (Soroca Centru, Soroca Nouă,
// Sculeni, Otaci, Briceni).
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/menu/site-footer";
import { SiteHeader } from "@/components/menu/site-header";
import { MotionStage } from "@/components/motion/motion-stage";
import { JsonLd } from "@/components/seo/json-ld";
import { POINTS, getCity, type Locale } from "@/data/points";
import { fill, getMessages } from "@/i18n/messages";
import { localePath, paths } from "@/i18n/routes";
import { formatPhoneDisplay, phoneHref } from "@/lib/order/phone";
import { placeMapUrl, placeReviewUrl } from "@/lib/places";
import { restaurantSchema } from "@/lib/schema-org";
import { pageMetadata } from "@/lib/seo";

export function contactsMetadata(locale: Locale): Metadata {
  const t = getMessages(locale);
  return pageMetadata({
    locale,
    path: paths.contacts(),
    title: t.meta.contactsTitle,
    description: t.meta.contactsDescription,
  });
}

export function ContactsPage({ locale }: { locale: Locale }) {
  const t = getMessages(locale);
  // Часы у всех точек одинаковые (SPEC §1.1) — строка берёт первую
  const hours = POINTS[0].hours;

  return (
    <>
      <JsonLd data={POINTS.map((p) => restaurantSchema(p, locale))} />
      <MotionStage />
      <SiteHeader locale={locale} t={t} />
      <main className="page pt-8 pb-16 lg:pt-12">
        <h1 className="font-display text-city uppercase">{t.contacts.title}</h1>
        <p className="mt-3 font-body text-body text-charcoal tabular-nums">
          {fill(t.contacts.hours, hours)}
        </p>

        <ul className="mt-8 grid gap-3 lg:grid-cols-2 lg:gap-4">
          {POINTS.map((point) => {
            const city = getCity(point.citySlug);
            return (
              <li key={point.id} className="contact-card">
                <h2 translate="no" className="font-ui text-title">
                  {point.name}
                </h2>
                <p className="mt-1 font-body text-meta text-charcoal">
                  <span translate="no">{city.name}</span>, {point.address}
                </p>
                <a
                  href={phoneHref(point.phone)}
                  className="contact-phone"
                  translate="no"
                >
                  {formatPhoneDisplay(point.phone)}
                </a>
                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
                  <Link
                    href={localePath(locale, paths.city(city.slug))}
                    className="btn-primary w-full lg:w-auto"
                  >
                    {t.contacts.order}
                  </Link>
                  <span className="contact-links">
                    <a href={placeMapUrl(point.placeId)} rel="noopener">
                      {t.contacts.map}
                    </a>
                    <span aria-hidden="true"> · </span>
                    <a href={placeReviewUrl(point.placeId)} rel="noopener">
                      {t.contacts.review}
                    </a>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
      <SiteFooter locale={locale} t={t} />
    </>
  );
}
