// Подвал всех страниц, кроме экрана городов: Section Rule (1px Ink), затем
// строки Montserrat 13px Smoke — реквизиты, ссылки на страницы, соцсети
// текстом (без иконок в кружочках). Реквизиты и соцсети — src/data/company.ts.
// Куски строки не рвутся посередине: перенос только между « · ».
import Link from "next/link";
import { COMPANY } from "@/data/company";
import type { Locale } from "@/data/points";
import type { Messages } from "@/i18n/messages";
import { localePath, paths } from "@/i18n/routes";

function Dot() {
  return <span aria-hidden="true"> · </span>;
}

/** IDNO — тринадцать цифр подряд, и Safari на iPhone принимает их за телефон:
 *  дописывает в готовый HTML свою ссылку tel:, а React от этого падает с
 *  «Hydration failed». Главный запрет — мета-тег format-detection в корневых
 *  метаданных (src/lib/seo.ts). Здесь вторая защита на случай, если мета-тег
 *  когда-нибудь потеряется: цифры разложены по двум отдельным элементам, и
 *  подряд идущего «номера» в разметке просто нет. На вид и при копировании
 *  строка та же — это проверено тестом. */
function Idno({ value }: { value: string }) {
  return (
    <span translate="no">
      <span>{value.slice(0, 4)}</span>
      <span>{value.slice(4)}</span>
    </span>
  );
}

export function SiteFooter({ locale, t }: { locale: Locale; t: Messages }) {
  const href = (path: string) => localePath(locale, path);
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
            <span className="whitespace-nowrap">
              IDNO <Idno value={COMPANY.idno} />
            </span>
            <Dot />
            <span className="whitespace-nowrap">{COMPANY.address[locale]}</span>
          </p>
          <p>
            <Link href={href(paths.contacts())}>{t.contacts.title}</Link>
            <Dot />
            <Link href={href(paths.privacy())}>{t.legal.privacy}</Link>
            <Dot />
            <Link href={href(paths.terms())}>{t.legal.terms}</Link>
            <Dot />
            <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
          </p>
          <p translate="no">
            <a href={COMPANY.social.instagram} rel="noopener">
              Instagram
            </a>
            <Dot />
            <a href={COMPANY.social.tiktok} rel="noopener">
              TikTok
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
