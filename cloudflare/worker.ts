// Точка входа Worker на Cloudflare (wrangler.jsonc → main). Оборачивает то,
// что собрал OpenNext
// (.open-next/worker.js), и поправляет ровно одну вещь — Cache-Control у
// страниц.
//
// Зачем это нужно. Правила кеша у нас в одном месте: next.config.ts →
// src/lib/cache-headers.ts. Обычный сервер Next (npm start) их и отдаёт,
// слово в слово. А на Workers OpenNext для готовых страниц подменяет
// Cache-Control своим — «s-maxage=<сколько осталось>, stale-while-revalidate
// =2592000». В нём нет части для браузера (max-age=0, must-revalidate), и
// без неё браузер решает срок годности страницы сам, на глазок: человек мог
// бы днями видеть вчерашнее меню, даже когда сайт давно перевыложен.
//
// Поэтому здесь: у ответов-страниц ставим ровно тот Cache-Control, что
// записан в cache-headers.ts. Всё остальное — файлы сборки, фото, ролики,
// API — не трогаем: у них свои правила, и их OpenNext не подменяет.
//
// Почему папка отдельная, а не src: файл ссылается на .open-next/worker.js,
// которого до сборки ещё нет. Внутри src такой импорт ронял бы проверку
// типов сайта — то «файла нет», то «пометка про отсутствие файла лишняя».
// Поэтому папка вынесена из проверки (tsconfig → exclude); собирает и
// проверяет её wrangler, а поведение целиком покрывает npm run test:e2e:cf.
import worker from "../.open-next/worker.js";
import { HTML_CACHE } from "../src/lib/cache-headers";

// Durable Objects адаптера: мы ими не пользуемся, но Worker обязан их
// вынести наружу — иначе Cloudflare не соберёт связки.
export {
  DOQueueHandler,
  DOShardedTagCache,
  BucketCachePurge,
} from "../.open-next/worker.js";

/** Что считаем страницей: то, что собирает Next и что может меняться от
 *  выкладки к выкладке — сами страницы, robots.txt и карта сайта. Файлы
 *  (сборка, фото, ролики) сюда не попадают: их отдаёт Cloudflare, и правила
 *  им задаёт public/_headers. */
const PAGE_TYPES = ["text/html", "text/plain", "application/xml"];

function isPage(request: Request, response: Response): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const type = response.headers.get("content-type") ?? "";
  return PAGE_TYPES.some((known) => type.startsWith(known));
}

const apetitWorker = {
  async fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
    const response = await (
      worker as {
        fetch(r: Request, e: unknown, c: unknown): Promise<Response>;
      }
    ).fetch(request, env, ctx);
    if (!isPage(request, response)) return response;

    // Страница «такого адреса нет» кешироваться не должна вовсе — этот
    // заголовок ставит сам Next (private, no-store), и он правильный.
    if (response.status === 404) return response;

    const patched = new Response(response.body, response);
    patched.headers.set("Cache-Control", HTML_CACHE);
    return patched;
  },
};

export default apetitWorker;
