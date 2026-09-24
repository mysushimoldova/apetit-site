-- 0006_place_order_is_test.sql — пометка тестового заказа ставится внутри
-- place_order(), одной вставкой. Применяется вручную: Supabase → SQL Editor →
-- вставить → Run. Повторный запуск безопасен. Требует 0005_test_orders.sql.
--
-- Что было: 0005 завела колонку orders.is_test, но пометку ставил отдельный
-- UPDATE сразу после place_order(). Между вставкой и пометкой строка
-- существовала как обычный заказ, и любой сбой на середине оставлял
-- тестовый заказ неотличимым от настоящего.
--
-- Что стало: у функции появился параметр p_is_test (по умолчанию false) —
-- признак пишется той же вставкой, в той же транзакции. Отдельного UPDATE
-- больше нет, промежуточного состояния тоже.
--
-- По умолчанию false, поэтому старые вызовы без этого параметра работают
-- как раньше: сайт передаёт p_is_test только с сервера, поднятого самими
-- тестами (APETIT_E2E=1 + APETIT_TEST_SECRET, src/server/orders/test-mode.ts).
-- В боевой среде ни того, ни другого нет — is_test там остаётся false.

-- Прежняя функция на 16 параметров удаляется: иначе вызов с 16 аргументами
-- подошёл бы к обеим (у новой 17-й со значением по умолчанию) и Postgres
-- ответил бы «function is not unique».
drop function if exists public.place_order(
  text, text, text, text, text, text, jsonb, integer, text, text, timestamptz,
  integer, integer, integer, integer, integer);

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
  p_ip_window_seconds    integer,
  p_is_test              boolean default false
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
     ip_hash, dedup_hash, created_at, is_test)
  values
    (p_point_id, p_city, p_lang, p_name, p_phone, p_address, p_items, p_total,
     p_ip_hash, p_dedup_hash, p_now, coalesce(p_is_test, false))
  returning orders.id, orders.number, orders.created_at, orders.items, orders.total
    into r;

  return jsonb_build_object(
    'outcome', 'created', 'id', r.id, 'number', r.number,
    'created_at', r.created_at, 'items', r.items, 'total', r.total);
end;
$$;

revoke execute on function public.place_order(
  text, text, text, text, text, text, jsonb, integer, text, text, timestamptz,
  integer, integer, integer, integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.place_order(
  text, text, text, text, text, text, jsonb, integer, text, text, timestamptz,
  integer, integer, integer, integer, integer, boolean) to service_role;
