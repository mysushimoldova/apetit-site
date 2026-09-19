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
  /** Лист блюда (SPEC §3 шаг 3) */
  sheet: {
    /** Primary внизу: «Adaugă · 198 lei» */
    add: string;
    size: string;
    without: string;
    extra: string;
    /** Пометка у блока «Fără»: убрать — бесплатно */
    free: string;
  };
  /** Корзина (SPEC §3 шаг 4) */
  cart: {
    title: string;
    /** «{n} poziție» — формы по Intl.PluralRules; {n} → число */
    positions: Record<Intl.LDMLPluralRule, string>;
    total: string;
    remove: string;
    order: string;
  };
  /** Подтверждение: корзина другого города */
  citySwitch: {
    title: string;
    confirm: string;
    cancel: string;
  };
  /** Подписи только для скринридера (на экране — значки) */
  a11y: {
    close: string;
    decrease: string;
    increase: string;
    quantity: string;
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
    sheet: {
      add: "Adaugă",
      size: "Mărime",
      without: "Fără",
      extra: "Extra",
      free: "gratuit",
    },
    cart: {
      title: "Coș",
      // «de poziții» (от 20) — грамматическая форма, не из списка архитектора
      positions: {
        zero: "{n} poziții",
        one: "{n} poziție",
        two: "{n} poziții",
        few: "{n} poziții",
        many: "{n} de poziții",
        other: "{n} de poziții",
      },
      total: "Total",
      remove: "Șterge",
      order: "Comandă",
    },
    citySwitch: {
      title: "Ai schimbat orașul — coșul va fi golit",
      confirm: "Continuă",
      cancel: "Anulează",
    },
    // Подписи для скринридера — мои слова, на утверждение (PROGRESS.md)
    a11y: {
      close: "Închide",
      decrease: "Scade cantitatea",
      increase: "Mărește cantitatea",
      quantity: "Cantitate",
    },
    meta: { cityTitle: "Apetit {city} — kebab, burgeri, comandă online" },
  },
  ru: {
    cityScreen: { title: "Выберите город" },
    header: { changeCity: "Сменить город", categories: "Категории" },
    menu: { from: "от", currency: "лей", grams: "г" },
    product: { add: "Добавить" },
    sheet: {
      add: "Добавить",
      size: "Размер",
      without: "Без",
      extra: "Добавки",
      free: "бесплатно",
    },
    cart: {
      title: "Корзина",
      // «позиций» (5–20) — грамматическая форма, не из списка архитектора
      positions: {
        zero: "{n} позиций",
        one: "{n} позиция",
        two: "{n} позиции",
        few: "{n} позиции",
        many: "{n} позиций",
        other: "{n} позиции",
      },
      total: "Итого",
      remove: "Удалить",
      order: "Заказать",
    },
    citySwitch: {
      title: "Вы сменили город — корзина будет очищена",
      confirm: "Продолжить",
      cancel: "Отмена",
    },
    a11y: {
      close: "Закрыть",
      decrease: "Уменьшить количество",
      increase: "Увеличить количество",
      quantity: "Количество",
    },
    meta: { cityTitle: "Apetit {city} — кебаб, бургеры, заказ онлайн" },
  },
};

export function getMessages(locale: Locale): Messages {
  return messages[locale];
}

/** «1 poziție», «3 poziții», «20 de poziții» / «5 позиций» — по правилам языка. */
export function plural(
  locale: Locale,
  forms: Record<Intl.LDMLPluralRule, string>,
  n: number,
): string {
  const form = new Intl.PluralRules(locale).select(n);
  return fill(forms[form], { n: String(n) });
}

/**
 * «228 lei» / «1 250 лей»: число — по правилам языка (Intl), перед валютой
 * неразрывный пробел, чтобы «lei» не уехало на следующую строку.
 */
export function formatPrice(
  locale: Locale,
  t: Messages,
  value: number,
): string {
  return `${new Intl.NumberFormat(locale).format(value)} ${t.menu.currency}`;
}

/** Подстановка {city} и других плейсхолдеров в шаблон текста. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? `{${key}}`);
}
