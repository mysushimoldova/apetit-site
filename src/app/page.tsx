// Экран городов (SPEC §3 шаг 1). Только пять плиток — без шапки, подвала,
// логотипа и текста.
import { CityGrid } from "@/components/city/city-grid";
import { buildCityRedirectScript } from "@/lib/city-redirect-script";

export default function Home() {
  return (
    <>
      {/* Редирект на сохранённый город до загрузки React — см. city-redirect-script.ts.
          Текст скрипта собирается из наших констант, пользовательских данных в нём нет. */}
      <script dangerouslySetInnerHTML={{ __html: buildCityRedirectScript() }} />
      <main className="page flex min-h-dvh items-center py-4">
        <CityGrid />
      </main>
    </>
  );
}
