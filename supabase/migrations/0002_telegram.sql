-- 0002_telegram.sql — Telegram (SPEC §4), атомарный лимит заказов (§9.4),
-- напоминания. Применяется вручную: Supabase → SQL Editor → вставить → Run.
-- Повторный запуск безопасен. Требует 0001_orders.sql.
-- Расширения включаются в панели (Database → Extensions): pg_cron (уже),
-- pg_net (для напоминаний — вызов сайта из cron).

-- ---------------------------------------------------------------------------
-- orders: напоминания и ошибка отправки в Telegram
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists reminders_sent   integer     not null default 0,
  add column if not exists last_reminder_at timestamptz,
  add column if not exists telegram_error   text;

-- ---------------------------------------------------------------------------
-- Чаты: точка → личный чат с ботом; владельцы — копии всех заказов
-- ---------------------------------------------------------------------------
create table if not exists public.telegram_chats (
  point_id  text        primary key,
  chat_id   bigint      not null,
  title     text,
  linked_at timestamptz not null default now()
);

create table if not exists public.owner_chats (
  chat_id   bigint      primary key,
  label     text,
  linked_at timestamptz not null default now()
);

-- Коды привязки: /start <код>. kind='point' → чат точки, 'owner' → владелец.
-- Один код на точку; коды случайные, создаются один раз (повтор не меняет).
create table if not exists public.telegram_codes (
  code       text        primary key,
  kind       text        not null check (kind in ('point', 'owner')),
  point_id   text        unique,
  label      text        not null,
  created_at timestamptz not null default now(),
  check ((kind = 'point') = (point_id is not null))
);

alter table public.telegram_chats enable row level security;
alter table public.owner_chats    enable row level security;
alter table public.telegram_codes enable row level security;

grant select, insert, update, delete on public.telegram_chats to service_role;
grant select, insert, update, delete on public.owner_chats    to service_role;
grant select, insert, update, delete on public.telegram_codes to service_role;

-- Случайный код из алфавита без похожих символов (0/O, 1/I/L): 8 знаков ≈ 40 бит.
-- Источник случайности — gen_random_uuid() (встроенный, криптостойкий),
-- чтобы не зависеть от pgcrypto; на каждый знак — свой uuid.
create or replace function public.random_link_code(len integer default 8)
returns text
language sql
volatile
set search_path = public
as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789',
           1 + (get_byte(uuid_send(gen_random_uuid()), 15) % 31), 1),
    '')
  from generate_series(1, len);
$$;
revoke execute on function public.random_link_code(integer) from public, anon, authenticated;

insert into public.telegram_codes (code, kind, point_id, label)
select public.random_link_code(), 'point', p.id, p.label
from (values
  ('soroca-centru', 'Apetit Centru'),
  ('soroca-noua',   'Apetit Soroca Nouă'),
  ('sculeni',       'Apetit Sculeni'),
  ('otaci',         'Apetit Otaci'),
  ('briceni',       'Apetit Briceni')
) as p(id, label)
where not exists (
  select 1 from public.telegram_codes c where c.point_id = p.id
);

insert into public.telegram_codes (code, kind, point_id, label)
select public.random_link_code(), 'owner', null, 'Proprietari'
where not exists (select 1 from public.telegram_codes where kind = 'owner');

-- ---------------------------------------------------------------------------
-- place_order — дубль, лимиты и INSERT в одной транзакции (SPEC §9.4).
-- Советующие блокировки по телефону и по IP: залп одновременных запросов
-- выстраивается в очередь, четвёртый за 10 минут не пройдёт.
-- Возвращает jsonb: {outcome: 'created'|'duplicate'|'limited', ...заказ}.
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_point_id             text,
  p_city                 text,
  p_lang                 text,
  p_name                 text,
  p_phone                text,
  p_address              text,
  p_items                jsonb,
  p_total                integer,
  p_ip_hash              text,
  p_dedup_hash           text,
  p_now                  timestamptz,
  p_dedup_seconds        integer,
  p_phone_limit          integer,
  p_phone_window_seconds integer,
  p_ip_limit             integer,
  p_ip_window_seconds    integer
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  r record;
begin
  -- Порядок захвата всегда одинаковый (телефон, потом IP) — без взаимных блокировок
  perform pg_advisory_xact_lock(hashtext('order-phone:' || p_phone));
  if p_ip_hash is not null then
    perform pg_advisory_xact_lock(hashtext('order-ip:' || p_ip_hash));
  end if;

  -- Тот же телефон и состав за окно дедупликации — вернуть записанный заказ
  select o.id, o.number, o.created_at, o.items, o.total
    into r
    from public.orders o
   where o.dedup_hash = p_dedup_hash
     and o.created_at > p_now - make_interval(secs => p_dedup_seconds)
   order by o.created_at desc
   limit 1;
  if found then
    return jsonb_build_object(
      'outcome', 'duplicate', 'id', r.id, 'number', r.number,
      'created_at', r.created_at, 'items', r.items, 'total', r.total);
  end if;

  if (select count(*) from public.orders o
       where o.phone = p_phone
         and o.created_at > p_now - make_interval(secs => p_phone_window_seconds))
     >= p_phone_limit then
    return jsonb_build_object('outcome', 'limited', 'by', 'phone');
  end if;

  if p_ip_hash is not null and
     (select count(*) from public.orders o
       where o.ip_hash = p_ip_hash
         and o.created_at > p_now - make_interval(secs => p_ip_window_seconds))
     >= p_ip_limit then
    return jsonb_build_object('outcome', 'limited', 'by', 'ip');
  end if;

  insert into public.orders
    (point_id, city, lang, name, phone, address, items, total,
     ip_hash, dedup_hash, created_at)
  values
    (p_point_id, p_city, p_lang, p_name, p_phone, p_address, p_items, p_total,
     p_ip_hash, p_dedup_hash, p_now)
  returning orders.id, orders.number, orders.created_at, orders.items, orders.total
    into r;

  return jsonb_build_object(
    'outcome', 'created', 'id', r.id, 'number', r.number,
    'created_at', r.created_at, 'items', r.items, 'total', r.total);
end;
$$;

revoke execute on function public.place_order(
  text, text, text, text, text, text, jsonb, integer, text, text, timestamptz,
  integer, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.place_order(
  text, text, text, text, text, text, jsonb, integer, text, text, timestamptz,
  integer, integer, integer, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- claim_due_reminders — какие заказы напомнить сейчас. Счётчик поднимается в
-- том же UPDATE, что и выборка: два запуска подряд не пришлют одно и то же.
-- Кнопка «Принят» ставит status='accepted' — заказ выпадает из выборки.
-- p_point_id — только для тестов (свои заказы); сайт передаёт null = все.
-- ---------------------------------------------------------------------------
create or replace function public.claim_due_reminders(
  p_now              timestamptz,
  p_interval_seconds integer,
  p_max              integer,
  p_point_id         text default null
)
returns setof jsonb
language sql
security invoker
set search_path = public
as $$
  update public.orders o
     set reminders_sent = o.reminders_sent + 1,
         last_reminder_at = p_now
   where o.status = 'new'
     and (p_point_id is null or o.point_id = p_point_id)
     and o.created_at <= p_now - make_interval(secs => p_interval_seconds)
     and o.reminders_sent < p_max
     and (o.last_reminder_at is null
          or o.last_reminder_at <= p_now - make_interval(secs => p_interval_seconds))
  returning jsonb_build_object(
    'id', o.id, 'number', o.number, 'point_id', o.point_id,
    'reminders_sent', o.reminders_sent);
$$;

revoke execute on function public.claim_due_reminders(timestamptz, integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.claim_due_reminders(timestamptz, integer, integer, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Будильник: pg_cron раз в минуту зовёт сайт (pg_net), сайт рассылает
-- напоминания. Адрес и секрет — в settings под ключом 'telegram_reminders':
--   insert into public.settings (key, value) values ('telegram_reminders',
--     '{"url": "https://apetit.md/api/telegram/reminders", "secret": "…"}');
-- Пока записи нет (сайт не опубликован) — функция ничего не делает.
-- ---------------------------------------------------------------------------
create or replace function public.ping_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg jsonb;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    return;
  end if;
  select value into cfg from public.settings where key = 'telegram_reminders';
  if cfg is null or cfg->>'url' is null or cfg->>'secret' is null then
    return;
  end if;
  perform net.http_post(
    url := cfg->>'url',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Reminders-Secret', cfg->>'secret'),
    body := '{}'::jsonb,
    timeout_milliseconds := 8000
  );
end;
$$;
revoke execute on function public.ping_reminders() from public, anon, authenticated;

select cron.schedule('telegram-reminders', '* * * * *', $$select public.ping_reminders()$$);
