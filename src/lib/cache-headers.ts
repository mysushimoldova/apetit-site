// Долгий кэш для файлов, которые не меняются под своим адресом.
// Next сам ставит его на /_next/static, но на Cloudflare (OpenNext) отдачей
// занимается не он, поэтому правило задаётся явно в next.config.ts.
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

export interface HeaderRule {
  source: string;
  headers: Header[];
}

export function immutableCacheRules(): HeaderRule[] {
  const headers: Header[] = [{ key: "Cache-Control", value: IMMUTABLE }];
  return [
    { source: "/img/:path*", headers },
    // Ролики заставки категории: имя файла = слаг блюда, содержимое под этим
    // адресом не меняется (docs/motion/splash-prompt.md)
    { source: "/splash/:path*", headers },
    { source: "/_next/static/:path*", headers },
    // Ответы API не кешируются ни браузером, ни промежуточными серверами:
    // это заказы и служебные маршруты, общего у двух запросов там ничего
    // нет (проверка insecure-defaults перед релизом).
    {
      source: "/api/:path*",
      headers: [{ key: "Cache-Control", value: NO_STORE }],
    },
  ];
}
