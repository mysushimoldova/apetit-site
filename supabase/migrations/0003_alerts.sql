-- 0003_alerts.sql — лестница напоминаний (SPEC §4.3): ступени в orders.
-- Применяется вручную: Supabase → SQL Editor → вставить → Run. Повторный
-- запуск безопасен. Требует 0002_telegram.sql.
--
-- Какой шаг пора слать, решает сайт (src/server/telegram/alerts.ts) по
-- src/config/alerts.json; база хранит счётчики и «забирает» шаг условным
-- UPDATE (где status='new' и счётчик равен ожидаемому) — два параллельных
-- запуска одно и то же не отправят, а «Am preluat» между выборкой и
-- отправкой отменяет ступень. Будильник прежний: ping_reminders() раз в
-- минуту → POST /api/telegram/reminders.

alter table public.orders
  -- Осталось от промежуточной схемы с тревогами (серии 🚨): код его больше
  -- не читает и не пишет. Убрать можно вместе с правками схемы для админки.
  add column if not exists alarm_stage         integer     not null default 0,
  -- сколько сообщений владельцам уже ушло
  add column if not exists owner_alerts_sent   integer     not null default 0,
  add column if not exists last_owner_alert_at timestamptz;

-- Кандидаты на ступень — только новые заказы; после последнего сообщения
-- владельцам заказ из выборки выпадает навсегда.
create index if not exists orders_new_created_at_idx
  on public.orders (created_at)
  where status = 'new';

-- Ступень выбирает код — функция из 0002 больше не нужна
drop function if exists public.claim_due_reminders(timestamptz, integer, integer, text);
