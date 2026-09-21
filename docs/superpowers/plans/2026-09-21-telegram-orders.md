# Заказы в Telegram — план реализации

**Goal:** заказ → сообщение точке с кнопкой «Принят», копии владельцам,
напоминания раз в 2 мин до 5 раз; привязка чатов кодом; атомарный лимит в
базе; HMAC для ip_hash; lang из формы; e2e убирают за собой.

**Spec:** промпт архитектора 21.09.2026 (второй); SPEC §4 полностью, §7, §9.

## Решения

- **Коды привязки — в базе** (`telegram_codes`): их 7 (6 точек + владелец),
  админка потом сможет менять/перевыпускать (SPEC §5.3 «привязка Telegram»);
  `.env` — для нескольких постоянных секретов, не для списка.
- **Отправка после ответа клиенту** — `after()` из `next/server` в Server
  Action: клиент видит успех сразу, три попытки с паузой идут после ответа.
  На Cloudflare `after` = waitUntil.
- **Атомарный лимит** — функция `place_order(...)` в базе (миграция 0002):
  `pg_advisory_xact_lock` по телефону и по IP, дубль → лимит → INSERT в одной
  транзакции. TS-store вызывает `rpc`; логика «принято/дубль/лимит» — в SQL.
- **Напоминания — pg_cron + pg_net** раз в минуту → `POST /api/telegram/
  reminders` с секретом `REMINDERS_SECRET`. Почему не Cloudflare Cron: работает
  одинаково на Cloudflare и Vercel (план Б; на Vercel Hobby cron — раз в
  сутки), cron в базе уже есть. Выбор заказов и счётчик — атомарным UPDATE …
  RETURNING (`claim_due_reminders()`), поэтому два запуска подряд не
  продублируют напоминание. URL и секрет cron берёт из `settings`
  (`telegram_reminders`), которые Амян заполнит после публикации.
- **Локальная проверка** — `scripts/telegram-dev.mjs`: getUpdates → POST на
  локальный `/api/telegram/webhook` с тем же секретом (тот же код, что в бою)
  + раз в 60 с POST на `/api/telegram/reminders`. Отказывается работать, если
  у бота стоит боевой webhook (не сломать прод).
- **e2e без Telegram** — `APETIT_E2E=1` (и не production) → подменённый
  отправитель, который только пишет в лог.
- **Кнопка** — `callback_data = accept:<uuid заказа>`; при нажатии проверяем,
  что чат — чат точки этого заказа; UPDATE … where status='new'.
- **Текст сообщения** — язык точки (Otaci ru); `lang` заказа — язык формы
  (хранится, для писем потом).

## Файлы

- `supabase/migrations/0002_telegram.sql` — telegram_chats, owner_chats,
  telegram_codes (+ коды), orders: reminders_sent, last_reminder_at,
  telegram_error; `place_order()`, `claim_due_reminders()`, cron-задание.
- `src/server/telegram/`: `api.ts` (Bot API через fetch), `texts.ts`,
  `message.ts` (HTML, экранирование), `chats.ts` (store), `notify.ts`
  (отправка + retry + telegram_message_id/telegram_error), `updates.ts`
  (/start, callback), `reminders.ts`, `secret.ts` (проверка заголовка).
- `src/app/api/telegram/webhook/route.ts`, `.../reminders/route.ts`.
- `scripts/telegram-dev.mjs`, `scripts/telegram-setup.mjs`.
- `src/server/orders/`: store → `place()` через rpc; hash → HMAC; submit →
  lang; index → after(notify).
- Форма: скрытое поле `lang`; zod `lang: enum(ro, ru)`.
- e2e: afterAll удаляет свои заказы по телефонам прогона.
