# Заказы в Supabase — план реализации

**Goal:** заказы, номера и лимиты — из памяти сервера в Supabase. Интерфейс
`submitOrder()` и форма не меняются. Telegram — следующая задача.

**Spec:** промпт архитектора 21.09.2026; SPEC §7 (язык заказа), §8, §9.3
(номер с 1001, снимок, цена на сервере), §9.4 (лимиты, дубли, honeypot).

## Схема (`supabase/migrations/0001_orders.sql`, применена Амяном)

- `order_number_seq` с 1001 → `orders.number default nextval(...)`: номер выдаёт
  база в момент INSERT, гонок нет.
- `orders` (id, number, point_id, city, lang, name, phone, address, items,
  total, status, created_at, accepted_at, ip_hash, dedup_hash,
  telegram_message_id) + 4 индекса; `settings` (key, value, updated_at).
- RLS на обеих без политик; явные GRANT только `service_role` (новые проекты
  Supabase не выдают права автоматически). anon → 42501 на всё.
- `anonymize_old_orders()` — SQL, security invoker, execute только
  service_role; pg_cron включён в панели, `cron.schedule` 03:00 UTC.

## Архитектура кода

- `src/server/db/supabase.ts` — `createServiceClient(url, key)`: типизированный
  клиент (`Database` в `types.ts`), без сессий. Чистый, без server-only —
  чтобы интеграционный тест мог собрать клиент из `.env.local`.
- `src/server/db/client.ts` — `import "server-only"`, `getServiceClient()`
  из `process.env` (ленивый singleton; при сборке env не нужен).
- `src/server/orders/store.ts` — интерфейс `OrderStore`
  (`findRecent(dedupHash, since)`, `countByPhone`, `countByIp`, `insert`,
  `anonymizeOldOrders`) + `createSupabaseOrderStore(client)`. Решения
  (сравнить счётчик с лимитом, вернуть старый номер) — в `submit.ts`; store
  только ходит в базу. В unit-тестах — `createFakeStore()` на массиве.
- `src/server/orders/hash.ts` — SHA-256 (Web Crypto: Node и Workers).
  `dedup_hash = sha256(phone|fingerprint)`, `ip_hash = sha256(ip)`.
- `submit.ts`: `ctx.memory` → `ctx.store`; порядок проверок прежний; ошибка
  базы → `{ ok: false, code: "db_error" }` (форма показывает «Comanda nu a
  fost primită…» веткой `default`), лог `db error` без персональных данных.
- `memory.ts` — удалить. `index.ts` — store поверх `getServiceClient()`.
- `created_at` пишем из `ctx.now` — та же «стрелка часов», что и для
  проверок окна (в e2e — тестовое время, только в dev-сервере).

## Тесты

- Unit `submit.test.ts` — те же 15 сценариев на fake store + `db_error`.
- Unit `store.test.ts` — `anonymizeOldOrders` вызывает `rpc("anonymize_old_orders")`
  (фейковый клиент), ошибка rpc → исключение.
- Интеграция `store.integration.test.ts` — только при `.env.local`: таблицы
  есть; anon — отказ; insert → номер ≥ 1001, растёт; findRecent/count по
  индексам; анонимизация старого заказа; в `afterAll` удаляет свои строки.
- E2e — существующий `checkout.spec.ts` против настоящей базы.
- Lint, build, `owasp-security` + `differential-review` до коммита.
