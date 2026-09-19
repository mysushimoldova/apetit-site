// Экран городов (SPEC §3 шаг 1, DESIGN.md → City Screen). Только пять плиток —
// без шапки, подвала, логотипа и видимого текста. Заголовок есть, но только
// для скринридеров (sr-only), на языке по умолчанию.
import { CityGrid } from "@/components/city/city-grid";
import { DEFAULT_LOCALE, getMessages } from "@/i18n/messages";
import { buildCityRedirectScript } from "@/lib/city-redirect-script";

export default function Home() {
  const t = getMessages(DEFAULT_LOCALE);

  return (
    <>
      {/* Редирект на сохранённый город до загрузки React — см. city-redirect-script.ts.
          Текст скрипта собирается из наших констант, пользовательских данных в нём нет. */}
      <script dangerouslySetInnerHTML={{ __html: buildCityRedirectScript() }} />
      <main className="page flex min-h-dvh items-center py-4">
        <h1 className="sr-only">{t.cityScreen.title}</h1>
        <CityGrid />
      </main>
    </>
  );
}
