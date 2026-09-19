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
    /** Добавки в блюдо: ингредиенты и соусы внутрь */
    extra: string;
    /** Соусы в стаканчике, отдельно от блюда (ответ архитектора) */
    sauceCup: string;
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
    /** Очистить корзину: первое нажатие — clear, второе — clearConfirm */
    clear: string;
    clearConfirm: string;
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
  /** Вне рабочих часов (SPEC §3): баннер на оформлении и в корзине */
  closed: {
    /** «Primim comenzi {open}–{close}» — часы точки */
    banner: string;
  };
  /** Оформление заказа (SPEC §3 шаг 5) */
  checkout: {
    title: string;
    /** Ссылка назад в меню */
    back: string;
    /** Блок выбора точки — только если в городе их больше одной */
    point: string;
    /** Адреса точек в SPEC пока нет */
    pointAddressMissing: string;
    /** «km» после расстояния «~1,2» */
    km: string;
    name: string;
    phone: string;
    /** Формат номера в пустом поле (SPEC §3 шаг 5) */
    phonePlaceholder: string;
    address: string;
    /** Подпись под «Adresă»: поле необязательное */
    addressHint: string;
    submit: string;
    /** Строка под кнопкой отправки */
    callNote: string;
    errors: {
      point: string;
      name: string;
      phone: string;
      address: string;
      network: string;
      unavailable: string;
      /** Пометка у позиции, которой нет в выбранной точке */
      unavailableLine: string;
      pointPaused: string;
      rateLimited: string;
      rejected: string;
    };
  };
  /** Экран подтверждения (SPEC §3 шаг 6, DESIGN → Order Confirmation) */
  confirmation: {
    /** Номер заказа крупно; {n} → номер */
    number: string;
    callSoon: string;
    /** Secondary с телефоном точки (DESIGN: «Sună la local») */
    call: string;
    back: string;
  };
  meta: {
    /** title страницы города; {city} → название города */
    cityTitle: string;
    /** title оформления и подтверждения; {city} → название города */
    checkoutTitle: string;
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
      sauceCup: "Sos aparte",
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
      clear: "Golește coșul",
      clearConfirm: "Da, golește",
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
    closed: { banner: "Primim comenzi {open}–{close}" },
    checkout: {
      title: "Comandă",
      back: "Înapoi la meniu",
      point: "Punctul",
      pointAddressMissing: "[ТЕКСТ: адрес точки]",
      km: "km",
      // «Nume», «Telefon», «Adresă» — перевод подписей SPEC §3, на утверждение
      name: "Nume",
      phone: "Telefon",
      phonePlaceholder: "0XX XXX XXX",
      address: "Adresă",
      addressHint: "dacă vrei livrare",
      submit: "Trimite comanda",
      callNote: "Casierul te va suna pentru confirmare",
      errors: {
        point: "[ТЕКСТ: ошибка — не выбран пункт]",
        name: "[ТЕКСТ: ошибка имени — 2–40 букв]",
        phone: "[ТЕКСТ: ошибка телефона — формат 0XX XXX XXX]",
        address: "[ТЕКСТ: ошибка адреса — до 120 символов]",
        network:
          "[ТЕКСТ: не отправилось — проверьте интернет и нажмите ещё раз]",
        unavailable: "[ТЕКСТ: части блюд нет в этом пункте — уберите их]",
        unavailableLine: "[ТЕКСТ: нет в этом пункте]",
        pointPaused: "[ТЕКСТ: пункт временно не принимает заказы]",
        rateLimited:
          "[ТЕКСТ: слишком много заказов с этого номера — позвоните]",
        rejected: "[ТЕКСТ: заказ не принят — попробуйте ещё раз]",
      },
    },
    confirmation: {
      // «Nr. {n}» — моё, на утверждение
      number: "Nr. {n}",
      callSoon: "Te sunăm în câteva minute",
      call: "Sună la local",
      back: "Înapoi la meniu",
    },
    meta: {
      cityTitle: "Apetit {city} — kebab, burgeri, comandă online",
      checkoutTitle: "Comandă — Apetit {city}",
    },
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
      sauceCup: "Соус отдельно",
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
      clear: "Очистить корзину",
      clearConfirm: "Да, очистить",
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
    // TODO ru: проверить — все строки ниже, кроме данных архитектором
    closed: { banner: "Принимаем заказы {open}–{close}" },
    checkout: {
      title: "Заказ",
      back: "Вернуться в меню",
      point: "Пункт",
      pointAddressMissing: "[ТЕКСТ: адрес точки]",
      km: "км",
      name: "Имя",
      phone: "Телефон",
      phonePlaceholder: "0XX XXX XXX",
      address: "Адрес",
      addressHint: "если нужна доставка",
      submit: "Отправить заказ",
      callNote: "Кассир перезвонит для подтверждения",
      errors: {
        point: "[ТЕКСТ: ошибка — не выбран пункт]",
        name: "[ТЕКСТ: ошибка имени — 2–40 букв]",
        phone: "[ТЕКСТ: ошибка телефона — формат 0XX XXX XXX]",
        address: "[ТЕКСТ: ошибка адреса — до 120 символов]",
        network:
          "[ТЕКСТ: не отправилось — проверьте интернет и нажмите ещё раз]",
        unavailable: "[ТЕКСТ: части блюд нет в этом пункте — уберите их]",
        unavailableLine: "[ТЕКСТ: нет в этом пункте]",
        pointPaused: "[ТЕКСТ: пункт временно не принимает заказы]",
        rateLimited:
          "[ТЕКСТ: слишком много заказов с этого номера — позвоните]",
        rejected: "[ТЕКСТ: заказ не принят — попробуйте ещё раз]",
      },
    },
    confirmation: {
      number: "№ {n}",
      callSoon: "Перезвоним через несколько минут",
      call: "Позвонить в заведение",
      back: "Вернуться в меню",
    },
    meta: {
      cityTitle: "Apetit {city} — кебаб, бургеры, заказ онлайн",
      checkoutTitle: "Заказ — Apetit {city}",
    },
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
