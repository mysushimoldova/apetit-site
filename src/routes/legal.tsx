// Правовые страницы — /confidentialitate, /termeni и их /ru-версии.
// Тексты — src/i18n/legal.ts; язык — из адреса, поэтому страница простая
// и статическая. Заголовок Oswald, текст Montserrat 16px, строка до 640px,
// подзаголовки Manrope 700. Без карточек и иконок. Внизу — «Înapoi la
// meniu», затем общий подвал.
import type { Metadata } from "next";
import { LegalBackLink } from "@/components/legal/legal-back-link";
import { SiteFooter } from "@/components/menu/site-footer";
import { SiteHeader } from "@/components/menu/site-header";
import { MotionStage } from "@/components/motion/motion-stage";
import { companyValues } from "@/data/company";
import type { Locale } from "@/data/points";
import { legalDocs, type LegalSlug } from "@/i18n/legal";
import { fill, getMessages } from "@/i18n/messages";
import { paths } from "@/i18n/routes";
import { pageMetadata } from "@/lib/seo";

/** «Politica de confidențialitate — Apetit» — title вкладки. */
export function legalTitle(slug: LegalSlug, locale: Locale): string {
  return `${legalDocs[slug][locale].title} — Apetit`;
}

export function legalMetadata(slug: LegalSlug, locale: Locale): Metadata {
  const t = getMessages(locale);
  return pageMetadata({
    locale,
    path: slug === "termeni" ? paths.terms() : paths.privacy(),
    title: legalTitle(slug, locale),
    description:
      slug === "termeni" ? t.meta.termsDescription : t.meta.privacyDescription,
  });
}

export function LegalPage({
  slug,
  locale,
}: {
  slug: LegalSlug;
  locale: Locale;
}) {
  const doc = legalDocs[slug][locale];
  const values = companyValues(locale);
  const t = getMessages(locale);

  return (
    <>
      <MotionStage />
      <SiteHeader locale={locale} t={t} />
      <main className="page pt-8 pb-16 lg:pt-12">
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
          <LegalBackLink label={t.legal.back} locale={locale} />
        </div>
      </main>
      <SiteFooter locale={locale} t={t} />
    </>
  );
}
