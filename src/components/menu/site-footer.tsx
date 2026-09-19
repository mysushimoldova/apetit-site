// Подвал страницы меню: Section Rule (1px Ink), затем две строки Montserrat
// 13px Smoke — реквизиты и ссылки. Реквизиты — из src/data/company.ts.
// Куски строки не рвутся посередине: перенос только между « · ».
import Link from "next/link";
import { COMPANY } from "@/data/company";
import type { Locale } from "@/data/points";
import type { Messages } from "@/i18n/messages";

function Dot() {
  return <span aria-hidden="true"> · </span>;
}

export function SiteFooter({ locale, t }: { locale: Locale; t: Messages }) {
  return (
    <footer className="site-footer">
      <div className="page">
        <div className="site-footer-inner">
          <p>
            <span className="whitespace-nowrap">
              © {COMPANY.copyrightYear}{" "}
              <span translate="no">{COMPANY.name}</span>
            </span>
            <Dot />
            <span className="whitespace-nowrap">IDNO {COMPANY.idno}</span>
            <Dot />
            <span className="whitespace-nowrap">{COMPANY.address[locale]}</span>
          </p>
          <p>
            <Link href="/confidentialitate">{t.legal.privacy}</Link>
            <Dot />
            <Link href="/termeni">{t.legal.terms}</Link>
            <Dot />
            <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
