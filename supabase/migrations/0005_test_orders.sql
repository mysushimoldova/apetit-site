-- 0005_test_orders.sql — пометка тестовых заказов (orders.is_test).
-- Применяется вручную: Supabase → SQL Editor → вставить → Run. Повторный
-- запуск безопасен. Требует 0004_drop_alarm_stage.sql.
--
-- Зачем: база у разработки и у боевого сайта одна. Заказы, которые
-- оставляют прогоны тестов, до сих пор отличались от настоящих только
-- именем и телефоном, и любой серверный механизм, который смотрит в
-- orders (напоминания, сообщения владельцам, будущая статистика), видел их
-- как обычные заказы. Хозяин получал в Telegram «заказ ждёт» по заказу,
-- которого никто не делал.
--
-- Теперь тестовость хранится в самой строке. Ставит её только сервер,
-- поднятый самими тестами (APETIT_E2E=1 + секрет APETIT_TEST_SECRET,
-- см. src/server/orders/test-mode.ts). В боевой среде ни того, ни другого
-- нет, поэтому is_test там не может стать true ни при каком запросе.
--
-- place_order() и выдача номеров не меняются: пометка ставится отдельным
-- UPDATE сразу после вставки, в том же запросе сервера.

alter table public.orders
  add column if not exists is_test boolean not null default false;

comment on column public.orders.is_test is
  'Заказ оставлен прогоном тестов. Telegram, напоминания и статистика его не видят.';

-- Кандидаты на напоминание — только настоящие заказы. Старый частичный
-- индекс (status = 'new') заменяется на более узкий: тестовые строки в него
-- не попадают вовсе.
drop index if exists public.orders_new_created_at_idx;
create index if not exists orders_new_live_created_at_idx
  on public.orders (created_at)
  where status = 'new' and is_test = false;
