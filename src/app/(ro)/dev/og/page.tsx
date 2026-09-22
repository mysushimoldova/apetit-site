// Макет OG-картинки — только для разработки: /dev/og и /dev/og?city=Soroca.
// В боевой сборке страницы нет: notFound() при сборке даёт обычный 404
// (проверено в e2e-prod/dev-routes.spec.ts). Снимает scripts/og-images.mjs.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OgCard } from "@/components/dev/og-card";
import { motionConfig } from "@/config/motion";
import { CITIES } from "@/data/points";

export const metadata: Metadata = {
  title: "OG-картинка — макет",
  robots: { index: false, follow: false },
};

export default async function DevOgPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { city: slug } = await searchParams;
  const city = slug ? CITIES.find((c) => c.slug === slug) : undefined;
  if (slug && !city) notFound();
  return (
    <main className="og-stage">
      <OgCard city={city?.name} settings={motionConfig.background} />
    </main>
  );
}
