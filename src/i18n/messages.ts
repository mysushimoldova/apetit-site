// Тексты интерфейса (CLAUDE.md: все тексты — через систему переводов).
// ro — основной, ru — второй. Ключи у обоих языков одинаковые (есть тест).
// Новый текст добавляется сразу в оба словаря; нет перевода — [ТЕКСТ: …].
// Слова «Adaugă», «Schimbă orașul», «de la», «lei» — из DESIGN.md 2.1;
// шаблон title — из SPEC §8. RU-версии — черновик. TODO ru: проверить.
import type { Locale } from "@/data/points";

export const DEFAULT_LOCALE: Locale = "ro";

export interface Messages {
  cityScreen: {
    /** Невидимый заголовок экрана городов — только для скринридеров */
    title: string;
  };
  header: {
    /** Подпись кнопки с названием города (нажатие = сменить город) */
    changeCity: string;
    /** Подпись ленты категорий для скринридера */
    categories: string;
  };
  menu: {
    /** «de la 80 lei» — при вариантах с разной ценой */
    from: string;
    currency: string;
    grams: string;
  };
  product: {
    /** Подпись круглой кнопки «+» */
    add: string;
  };
  meta: {
    /** title страницы города; {city} → название города */
    cityTitle: string;
  };
}

export const messages: Record<Locale, Messages> = {
  ro: {
    cityScreen: { title: "Alege orașul" },
    header: { changeCity: "Schimbă orașul", categories: "Categorii" },
    menu: { from: "de la", currency: "lei", grams: "g" },
    product: { add: "Adaugă" },
    meta: { cityTitle: "Apetit {city} — kebab, burgeri, comandă online" },
  },
  ru: {
    cityScreen: { title: "Выберите город" },
    header: { changeCity: "Сменить город", categories: "Категории" },
    menu: { from: "от", currency: "лей", grams: "г" },
    product: { add: "Добавить" },
    meta: { cityTitle: "Apetit {city} — кебаб, бургеры, заказ онлайн" },
  },
};

export function getMessages(locale: Locale): Messages {
  return messages[locale];
}

/** Подстановка {city} и других плейсхолдеров в шаблон текста. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? `{${key}}`);
}
