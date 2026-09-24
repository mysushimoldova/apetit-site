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
    /** Подпись переключателя RO/RU для скринридера */
    language: string;
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
    /** Та же кнопка, пока заказ отправляется (неактивна, без крутилки) */
    sending: string;
    /** Строка под кнопкой отправки */
    callNote: string;
    /** Строка согласия под callNote: {terms} и {privacy} — ссылки */
    consent: {
      text: string;
      /** Текст ссылки на /termeni внутри фразы (в ru — в падеже фразы) */
      terms: string;
      /** Текст ссылки на /confidentialitate внутри фразы */
      privacy: string;
    };
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
      /** База не ответила: заказ не записан, но повтор имеет смысл */
      dbError: string;
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
  /** Страница «такого адреса нет» (src/app/global-not-found.tsx) */
  notFound: {
    /** Заголовок под большой цифрой 404 */
    title: string;
    /** Одна строка объяснения: почему адрес не открылся */
    text: string;
    /** Подпись кнопки возврата (в меню города или на выбор города) */
    back: string;
  };
  /** Правовые страницы и подвал */
  legal: {
    /** Ссылка на /confidentialitate в подвале */
    privacy: string;
    /** Ссылка на /termeni в подвале */
    terms: string;
    /** Ссылка внизу правовой страницы */
    back: string;
  };
  /** Страница контактов (SPEC §8) */
  contacts: {
    title: string;
    /** «Lucrăm zilnic {open}–{close}» — часы точек */
    hours: string;
    /** Primary в карточке точки → меню города */
    order: string;
    /** Ссылка на Google Maps по Place ID */
    map: string;
    /** Ссылка «оставить отзыв» в Google */
    review: string;
  };
  meta: {
    /** title и description экрана городов */
    homeTitle: string;
    homeDescription: string;
    /** title страницы города; {city} → название города */
    cityTitle: string;
    cityDescription: string;
    /** title оформления и подтверждения; {city} → название города */
    checkoutTitle: string;
    checkoutDescription: string;
    contactsTitle: string;
    contactsDescription: string;
    /** description правовых страниц (title — из src/i18n/legal.ts) */
    privacyDescription: string;
    termsDescription: string;
  };
}

export const messages: Record<Locale, Messages> = {
  ro: {
    cityScreen: { title: "Alege orașul" },
    header: {
      changeCity: "Schimbă orașul",
      categories: "Categorii",
      language: "Limba",
    },
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
    // Тексты оформления и подтверждения утверждены архитектором 19.09.2026
    closed: { banner: "Primim comenzi {open}–{close}" },
    checkout: {
      title: "Comandă",
      back: "Înapoi la meniu",
      point: "Punctul",
      km: "km",
      name: "Nume",
      phone: "Telefon",
      phonePlaceholder: "0XX XXX XXX",
      address: "Adresă",
      addressHint: "dacă vrei livrare",
      submit: "Trimite comanda",
      sending: "Se trimite…",
      callNote: "Casierul te va suna pentru confirmare",
      // Строка согласия и подвал — утверждены архитектором 19.09.2026
      consent: {
        text: "Trimițând comanda, ești de acord cu {terms} și {privacy}.",
        terms: "Termenii",
        privacy: "Politica de confidențialitate",
      },
      errors: {
        point: "Alege punctul",
        name: "Scrie numele (2–40 de litere)",
        phone: "Număr în format 0XX XXX XXX",
        address: "Adresa e prea lungă (max. 120 de caractere)",
        network: "Nu s-a trimis. Verifică internetul și încearcă din nou.",
        unavailable:
          "Unele produse nu sunt disponibile în acest punct. Scoate-le din coș.",
        unavailableLine: "nu este în acest punct",
        pointPaused: "Acest punct nu primește comenzi momentan.",
        rateLimited: "Prea multe comenzi de pe acest număr. Sună la local.",
        dbError: "Nu am reușit să salvăm comanda. Încearcă din nou.",
        rejected: "Comanda nu a fost primită. Încearcă din nou.",
      },
    },
    confirmation: {
      number: "Nr. {n}",
      callSoon: "Te sunăm în câteva minute",
      call: "Sună la local",
      back: "Înapoi la meniu",
    },
    // Тексты 404 — из задания архитектора 24.09.2026
    notFound: {
      title: "Pagina nu există",
      text: "Poate link-ul e vechi sau adresa e scrisă greșit.",
      back: "Înapoi la meniu",
    },
    legal: {
      privacy: "Politica de confidențialitate",
      terms: "Termeni",
      back: "Înapoi la meniu",
    },
    // Кнопки и заголовок — из задания 22.09.2026; строка часов — по ru-тексту
    // задания, ro — черновик на утверждение (PROGRESS.md)
    contacts: {
      title: "Contacte",
      hours: "Lucrăm zilnic {open}–{close}",
      order: "Comandă",
      map: "Vezi pe hartă",
      review: "Lasă o recenzie",
    },
    // Заголовок меню — SPEC §8; описания — черновик на утверждение
    meta: {
      homeTitle: "Apetit — kebab, burgeri, gözleme. Comandă online",
      homeDescription:
        "Apetit — fast food în Soroca, Sculeni, Otaci și Briceni. Alege orașul, vezi meniul și comandă online în 30 de secunde.",
      cityTitle: "Apetit {city} — kebab, burgeri, comandă online",
      cityDescription:
        "Meniul Apetit {city}: kebab, burgeri, gözleme, crispy, pizza. Comandă online — casierul te sună pentru confirmare. Zilnic 08:30–23:00.",
      checkoutTitle: "Comandă — Apetit {city}",
      checkoutDescription: "Finalizează comanda la Apetit {city}.",
      contactsTitle: "Contacte — Apetit",
      contactsDescription:
        "Punctele Apetit din Soroca, Sculeni, Otaci și Briceni: adrese, telefoane, program 08:30–23:00, hartă și recenzii Google.",
      privacyDescription:
        "Ce date păstrează Apetit când comanzi online și cum le protejăm.",
      termsDescription:
        "Condițiile în care Apetit primește și pregătește comenzile online.",
    },
  },
  ru: {
    cityScreen: { title: "Выберите город" },
    header: {
      changeCity: "Сменить город",
      categories: "Категории",
      language: "Язык",
    },
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
    // Тексты оформления и подтверждения утверждены архитектором 19.09.2026
    closed: { banner: "Принимаем заказы {open}–{close}" },
    checkout: {
      title: "Заказ",
      back: "Вернуться в меню",
      point: "Пункт",
      km: "км",
      name: "Имя",
      phone: "Телефон",
      phonePlaceholder: "0XX XXX XXX",
      address: "Адрес",
      addressHint: "если нужна доставка",
      submit: "Отправить заказ",
      sending: "Отправляем…",
      callNote: "Кассир перезвонит для подтверждения",
      consent: {
        text: "Отправляя заказ, вы соглашаетесь с {terms} и {privacy}.",
        terms: "Условиями",
        privacy: "Политикой конфиденциальности",
      },
      errors: {
        point: "Выберите пункт",
        name: "Введите имя (2–40 букв)",
        phone: "Номер в формате 0XX XXX XXX",
        address: "Адрес слишком длинный (до 120 символов)",
        network: "Не отправилось. Проверьте интернет и попробуйте ещё раз.",
        unavailable:
          "Некоторые блюда недоступны в этом пункте. Уберите их из корзины.",
        unavailableLine: "нет в этом пункте",
        pointPaused: "Этот пункт временно не принимает заказы.",
        rateLimited:
          "Слишком много заказов с этого номера. Позвоните в заведение.",
        dbError: "Не смогли записать заказ. Попробуйте ещё раз.",
        rejected: "Заказ не принят. Попробуйте ещё раз.",
      },
    },
    confirmation: {
      number: "№ {n}",
      callSoon: "Перезвоним через несколько минут",
      call: "Позвонить в заведение",
      back: "Вернуться в меню",
    },
    // Тексты 404 — из задания архитектора 24.09.2026
    notFound: {
      title: "Страница не найдена",
      text: "Возможно, ссылка устарела или в адресе опечатка.",
      back: "Вернуться в меню",
    },
    legal: {
      privacy: "Политика конфиденциальности",
      terms: "Условия",
      back: "Вернуться в меню",
    },
    // TODO ru: проверить
    contacts: {
      title: "Контакты",
      hours: "Работаем ежедневно {open}–{close}",
      order: "Заказать",
      map: "Показать на карте",
      review: "Оставить отзыв",
    },
    // TODO ru: проверить
    meta: {
      homeTitle: "Apetit — кебаб, бургеры, гёзлеме. Заказ онлайн",
      homeDescription:
        "Apetit — фастфуд в Сороках, Скуленах, Отачь и Бричанах. Выберите город, посмотрите меню и закажите онлайн за 30 секунд.",
      cityTitle: "Apetit {city} — кебаб, бургеры, заказ онлайн",
      cityDescription:
        "Меню Apetit {city}: кебаб, бургеры, гёзлеме, криспи, пицца. Заказ онлайн — кассир перезвонит для подтверждения. Ежедневно 08:30–23:00.",
      checkoutTitle: "Заказ — Apetit {city}",
      checkoutDescription: "Оформление заказа в Apetit {city}.",
      contactsTitle: "Контакты — Apetit",
      contactsDescription:
        "Точки Apetit в Сороках, Скуленах, Отачь и Бричанах: адреса, телефоны, часы 08:30–23:00, карта и отзывы Google.",
      privacyDescription:
        "Какие данные Apetit хранит при заказе онлайн и как мы их защищаем.",
      termsDescription:
        "Условия, на которых Apetit принимает и готовит онлайн-заказы.",
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
