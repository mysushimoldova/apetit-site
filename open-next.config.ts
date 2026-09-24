// OpenNext для Cloudflare Workers (SPEC §9.1, план A). Собирает сборку
// Next в Worker: npm run build:cf.
//
// Настроек по минимуму намеренно. Всё «умное», что предлагает адаптер
// (очереди, кэш тегов, Durable Objects, R2), требует отдельно заводимых
// хранилищ и Амяну сейчас не нужно: страницы сайта готовятся при сборке,
// а кеш у Cloudflare живёт минуту по заголовкам (src/lib/cache-headers.ts).
//
// incrementalCache — обязателен, иначе страницы городов отвечают 404.
// Готовые страницы (/soroca, /ru/soroca, /soroca/comanda — те, что Next
// помечает ● SSG) лежат среди файлов сборки, и по умолчанию адаптер не
// знает, где их искать: любой запрос к ним падает с NoFallbackError.
// staticAssetsIncrementalCache берёт их прямо из файлов, которые уже
// отдаёт Cloudflare, — без R2, KV и прочих платных хранилищ.
//
// Ограничение этого варианта: страницы не «протухают» сами (revalidate).
// Нам это и не нужно: меню меняется вместе с кодом, то есть новой выкладкой.
// Появится ISR — понадобится R2 или KV, и это будет отдельное решение.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
