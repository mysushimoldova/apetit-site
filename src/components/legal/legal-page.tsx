// Правовая страница (/confidentialitate, /termeni). Статическая: в HTML обе
// версии текста, видна одна — по языку (src/lib/legal-lang.ts).
// Заголовок Oswald, текст Montserrat 16px, строка до 640px, подзаголовки
// Manrope 700. Без карточек и иконок. Внизу — «Înapoi la meniu».
import { companyValues } from "@/data/company";
import type { Locale } from "@/data/points";
import { legalDocs, type LegalSlug } from "@/i18n/legal";
import { fill, getMessages } from "@/i18n/messages";
import { buildLegalLangScript } from "@/lib/legal-lang";
import { LegalBackLink } from "./legal-back-link";
import { LegalHeader } from "./legal-header";
import { LegalRoot } from "./legal-root";

const LOCALES: Locale[] = ["ro", "ru"];

/** «Politica de confidențialitate — Apetit» — title вкладки. Он один, на ro:
 *  Next 16 сам управляет <title>, подмена после загрузки им перезаписывается. */
export function legalTitle(slug: LegalSlug, locale: Locale): string {
  return `${legalDocs[slug][locale].title} — Apetit`;
}

function LegalArticle({ slug, locale }: { slug: LegalSlug; locale: Locale }) {
  const doc = legalDocs[slug][locale];
  const values = companyValues(locale);
  const t = getMessages(locale);

  return (
    <div lang={locale} data-variant={locale}>
      <article className="legal-text">
        <h1 className="legal-title">{doc.title}</h1>
        <p className="legal-updated">{doc.updated}</p>
        {doc.blocks.map((block, i) =>
          block.kind === "section" ? (
            <section key={i}>
              <h2>{block.heading}</h2>
              {block.paragraphs.map((p, j) => (
                <p key={j}>{fill(p, values)}</p>
              ))}
            </section>
          ) : (
            <ol key={i}>
              {block.items.map((item, j) => (
                <li key={j}>{fill(item, values)}</li>
              ))}
            </ol>
          ),
        )}
      </article>
      <div className="mt-12">
        <LegalBackLink label={t.legal.back} />
      </div>
    </div>
  );
}

export function LegalPage({ slug }: { slug: LegalSlug }) {
  const changeCity = {
    ro: getMessages("ro").header.changeCity,
    ru: getMessages("ru").header.changeCity,
  };

  return (
    <LegalRoot>
      {/* Язык по сохранённому городу — до отрисовки, см. legal-lang.ts.
          Текст скрипта — из наших констант, пользовательских данных нет. */}
      <script dangerouslySetInnerHTML={{ __html: buildLegalLangScript() }} />
      <LegalHeader changeCity={changeCity} />
      <main className="page pt-8 pb-16 lg:pt-12">
        {LOCALES.map((locale) => (
          <LegalArticle key={locale} slug={slug} locale={locale} />
        ))}
      </main>
    </LegalRoot>
  );
}
