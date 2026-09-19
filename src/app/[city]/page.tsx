// Временная заглушка страницы города. Меню — следующая задача.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RememberCity } from "@/components/city/remember-city";
import { CITIES, getCity, isCitySlug } from "@/data/points";

type Props = { params: Promise<{ city: string }> };

// Все пять городов известны заранее — страницы статические.
export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }));
}

// Любой другой slug → 404, а не попытка отрендерить.
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  if (!isCitySlug(city)) return {};
  return { title: `Apetit ${getCity(city).name}` };
}

export default async function CityPage({ params }: Props) {
  const { city: slug } = await params;
  if (!isCitySlug(slug)) notFound();
  const city = getCity(slug);

  return (
    <main className="page flex min-h-dvh flex-col justify-center gap-4 py-16">
      <RememberCity slug={city.slug} />
      <h1 className="font-display text-city uppercase">{city.name}</h1>
      {/* Временно: меню появится в следующей задаче */}
      <p className="font-body text-body text-charcoal">[ТЕКСТ: меню скоро]</p>
    </main>
  );
}
