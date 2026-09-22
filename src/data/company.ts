// Реквизиты компании — одно место на весь сайт: подвал меню, политика
// конфиденциальности, условия. Поменять e-mail или адрес — только здесь.
// Значения утверждены архитектором 19.09.2026.
import type { Locale } from "./points";

export const COMPANY = {
  /** Юридическое название — на обоих языках одинаково */
  name: "S.R.L. „APETIT STREET”",
  idno: "1023607001174",
  /** Юридический адрес — как в утверждённых текстах ro и ru */
  address: {
    ro: "or. Soroca, str. Tiraspol 4",
    ru: "г. Сорока, ул. Тирасполь 4",
  } satisfies Record<Locale, string>,
  email: "dddpaskary@gmail.com",
  /** Соцсети — подвал и страница контактов (SPEC §8). Facebook нет. */
  social: {
    instagram: "https://www.instagram.com/apetit.md/",
    tiktok: "https://www.tiktok.com/@apetit.md",
  },
  /** Год в строке «© 2026 …» подвала */
  copyrightYear: 2026,
} as const;

/** Подстановки для текстов: {company}, {idno}, {address}, {email}. */
export function companyValues(locale: Locale): Record<string, string> {
  return {
    company: COMPANY.name,
    idno: COMPANY.idno,
    address: COMPANY.address[locale],
    email: COMPANY.email,
  };
}
