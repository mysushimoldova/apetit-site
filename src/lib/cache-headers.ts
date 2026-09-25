// Кеш ответов сайта. Три разных правила, и каждое — про свой срок жизни.
//
// Next сам ставит долгий кеш на /_next/static, но на Cloudflare (OpenNext)
// отдачей занимается не он, поэтому все правила заданы явно в next.config.ts.
//
// /img — наши готовые файлы: фото блюд (<slug>-400|800|1600.webp) и значки.
// Имя фото = slug блюда и не меняется при замене картинки: тому, кто уже
// открывал сайт, новое фото под тем же именем придёт не раньше, чем через
// год (см. вопрос в PROGRESS.md — нужен признак версии в адресе).

import type { Header } from "./security-headers";

/** Год, неизменяемо. */
export const IMMUTABLE = "public, max-age=31536000, immutable";

/** Никакого кеша: ответы API у всех разные и устаревают мгновенно. */
export const NO_STORE = "no-store";

/**
 * HTML страниц: у браузера не живёт совсем, у Cloudflare — минуту, и ещё
 * пять минут старая копия может отдаваться, пока в фоне берётся свежая.
 *
 * Почему не год (так было до 24.09.2026): страницы не неизменяемые. Меню,
 * цены, часы работы и «точка закрыта» меняются, и с годовым s-maxage люди
 * месяцами видели бы старое меню, даже когда сайт уже перевыложен.
 * max-age=0 и must-revalidate — чтобы у человека в браузере не осело
 * вчерашнее меню; s-maxage=60 — чтобы Cloudflare всё-таки принимал на себя
 * поток; stale-while-revalidate=300 — чтобы обновление кеша никому не
 * стоило ожидания.
 */
export const HTML_CACHE =
  "public, max-age=0, must-revalidate, s-maxage=60, stale-while-revalidate=300";

/**
 * Что НЕ является страницей: у этих адресов свои правила ниже, и попасть
 * под правило для HTML они не должны — иначе на один ответ ушло бы два
 * разных Cache-Control.
 */
const NOT_HTML = "_next|img|splash|api";

export interface HeaderRule {
  source: string;
  headers: Header[];
}

/** Сборка Next: куски кода, стили, шрифты. */
const BUILD = "/_next/static/:path*";

/**
 * dev — правила для `next dev`. В разработке имя куска сборки не меняется,
 * когда меняется код (в боевой сборке в имени — отпечаток содержимого).
 * Годовой immutable на них заставлял телефон брать старые куски из кеша
 * вперемешку с новыми: заставка получала настройки старого вида и вешала
 * страницу (25.09.2026). Поэтому в dev правила для сборки нет — заголовки
 * ей ставит сам Next. Фото и ролики остаются как в бою: заставка ждёт
 * ролик не дольше 150 мс, и перепроверка у сервера при каждом нажатии
 * съела бы это время.
 */
export function cacheRules(dev = false): HeaderRule[] {
  const headers: Header[] = [{ key: "Cache-Control", value: IMMUTABLE }];
  const rules: HeaderRule[] = [
    // Всё, кроме сборки, фото, роликов и API, — это страницы сайта
    {
      source: `/:path((?!${NOT_HTML}).*)`,
      headers: [{ key: "Cache-Control", value: HTML_CACHE }],
    },
    { source: "/img/:path*", headers },
    // Ролики заставки категории: имя файла = слаг блюда, содержимое под этим
    // адресом не меняется (docs/motion/splash-prompt.md)
    { source: "/splash/:path*", headers },
    { source: BUILD, headers },
    // Ответы API не кешируются ни браузером, ни промежуточными серверами:
    // это заказы и служебные маршруты, общего у двух запросов там ничего
    // нет (проверка insecure-defaults перед релизом).
    {
      source: "/api/:path*",
      headers: [{ key: "Cache-Control", value: NO_STORE }],
    },
  ];
  return dev ? rules.filter((rule) => rule.source !== BUILD) : rules;
}
