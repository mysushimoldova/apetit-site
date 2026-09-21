-- 0001_orders.sql — заказы, настройки, анонимизация (SPEC §9.3, §9.4).
-- Применяется вручную: Supabase → SQL Editor → New query → вставить → Run.
-- Повторный запуск безопасен (if not exists / or replace).

-- ---------------------------------------------------------------------------
-- Номера заказов: сквозные, с 1001 (SPEC §9.3). Номер выдаёт база в момент
-- INSERT — два одновременных заказа не получат один номер.
-- ---------------------------------------------------------------------------
create sequence if not exists public.order_number_seq
  as integer
  start with 1001
  increment by 1
  no cycle;

-- ---------------------------------------------------------------------------
-- orders — один заказ = одна строка. items — снимок позиций с названиями и
-- ценами на момент заказа; total — сумма в леях, посчитанная сервером.
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id                  uuid        primary key default gen_random_uuid(),
  number              integer     not null unique
                                  default nextval('public.order_number_seq'),
  point_id            text        not null,
  city                text        not null,
  lang                text        not null,
  name                text        not null,
  -- Нормализованный телефон клиента: +373XXXXXXXX
  phone               text        not null,
  address             text,
  items               jsonb       not null,
  total               integer     not null check (total >= 0),
  status              text        not null default 'new'
                                  check (status in ('new', 'accepted', 'cancelled')),
  created_at          timestamptz not null default now(),
  accepted_at         timestamptz,
  -- SHA-256 от IP клиента: лимит по IP без хранения самого адреса
  ip_hash             text,
  -- SHA-256 от «телефон + состав»: тот же заказ за 2 минуты — не дубль
  dedup_hash          text        not null,
  telegram_message_id bigint
);

comment on table public.orders is
  'Заказы с сайта (SPEC §9.3). Доступ только с сервера (service role).';

-- Лимит с номера (≤3 за 10 мин), лимит по IP, дедупликация, очередь точки
create index if not exists orders_phone_created_at_idx
  on public.orders (phone, created_at);
create index if not exists orders_ip_hash_created_at_idx
  on public.orders (ip_hash, created_at);
create index if not exists orders_dedup_hash_created_at_idx
  on public.orders (dedup_hash, created_at);
create index if not exists orders_point_id_status_idx
  on public.orders (point_id, status);

-- ---------------------------------------------------------------------------
-- settings — ключ/значение для будущей админки (SPEC §5). Пока пустая.
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  key        text        primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now()
);

comment on table public.settings is
  'Настройки сайта для админки (SPEC §5). Доступ только с сервера.';

-- ---------------------------------------------------------------------------
-- RLS включён, политик нет: anon и authenticated не видят ничего и не могут
-- писать. Сервер ходит с service role — он RLS обходит.
-- ---------------------------------------------------------------------------
alter table public.orders   enable row level security;
alter table public.settings enable row level security;

-- ---------------------------------------------------------------------------
-- Права. В новых проектах Supabase таблица в public по умолчанию никому
-- не доступна через API (ни anon, ни service_role) — доступ выдаётся явно.
-- Выдаём только серверной роли; anon и authenticated не получают ничего.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.orders   to service_role;
grant select, insert, update, delete on public.settings to service_role;
-- INSERT в orders берёт номер из sequence — нужен usage
grant usage, select on sequence public.order_number_seq to service_role;

-- ---------------------------------------------------------------------------
-- Анонимизация: заказам старше 365 дней стираем имя, телефон и адрес.
-- Состав, сумма и точка остаются для статистики. Возвращает число строк.
-- ---------------------------------------------------------------------------
create or replace function public.anonymize_old_orders()
returns integer
language sql
security invoker
set search_path = public
as $$
  with done as (
    update public.orders
       set name = '',
           phone = '',
           address = null
     where created_at < now() - interval '365 days'
       and (name <> '' or phone <> '' or address is not null)
    returning 1
  )
  select count(*)::integer from done;
$$;

-- Функцию нельзя дёргать через публичный API анонимным ключом
revoke execute on function public.anonymize_old_orders() from public;
revoke execute on function public.anonymize_old_orders() from anon;
revoke execute on function public.anonymize_old_orders() from authenticated;
grant  execute on function public.anonymize_old_orders() to service_role;

-- ---------------------------------------------------------------------------
-- Расписание: раз в сутки в 03:00 UTC (06:00 по Кишинёву летом).
-- Расширение pg_cron включается в панели: Database → Extensions → pg_cron
-- (через SQL «create extension» на Supabase не проходит — ошибка
-- «dependent privileges exist»). Включено 21.09.2026.
-- На Free-тарифе проект «засыпает» после недели без обращений — задание
-- в это время не выполняется; пропущенные запуски не навёрстывает —
-- сработает в ближайшие 03:00 после пробуждения.
-- ---------------------------------------------------------------------------

-- Одно имя = одно задание: повторный запуск перезапишет, а не продублирует
select cron.schedule(
  'anonymize-old-orders',
  '0 3 * * *',
  $$select public.anonymize_old_orders()$$
);
