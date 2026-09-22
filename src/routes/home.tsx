// Экран городов (SPEC §3 шаг 1, DESIGN.md → City Screen) — «/» и «/ru».
// Только плитки — без шапки, подвала, логотипа и видимого текста. Заголовок
// есть, но только для скринридеров (sr-only). Organization для поисковиков.
import type { Metadata } from "next";
import { CityGrid } from "@/components/city/city-grid";
import { MotionStage } from "@/components/motion/motion-stage";
import { JsonLd } from "@/components/seo/json-ld";
import type { Locale } from "@/data/points";
import { getMessages } from "@/i18n/messages";
import { paths } from "@/i18n/routes";
import { buildCityRedirectScript } from "@/lib/city-redirect-script";
import { organizationSchema } from "@/lib/schema-org";
import { pageMetadata } from "@/lib/seo";

export function homeMetadata(locale: Locale): Metadata {
  const t = getMessages(locale);
  return pageMetadata({
    locale,
    path: paths.home(),
    title: t.meta.homeTitle,
    description: t.meta.homeDescription,
  });
}

export function HomeScreen({ locale }: { locale: Locale }) {
  const t = getMessages(locale);

  return (
    <>
      {/* Редирект на сохранённый город до загрузки React — см. city-redirect-script.ts.
          Текст скрипта собирается из наших констант, пользовательских данных в нём нет. */}
      <script
        dangerouslySetInnerHTML={{ __html: buildCityRedirectScript(locale) }}
      />
      <JsonLd data={organizationSchema()} />
      <MotionStage />
      <main className="page flex min-h-dvh items-center py-4">
        <h1 className="sr-only">{t.cityScreen.title}</h1>
        <CityGrid locale={locale} />
      </main>
    </>
  );
}
