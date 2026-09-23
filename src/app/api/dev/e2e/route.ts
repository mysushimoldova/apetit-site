// «Этот сервер подняли тесты» — единственная задача маршрута.
//
// Playwright переиспользует уже запущенный dev-сервер (reuseExistingServer),
// и если хозяин оставил свой `npm run dev`, прогон идёт по серверу БЕЗ
// APETIT_E2E: там живой бот, и каждый тестовый заказ улетает настоящим
// сообщением в Telegram. Именно так к владельцу приходили заказы, которых
// никто не делал.
//
// Поэтому перед прогоном e2e/global-setup.ts стучится сюда со своим
// секретом. Ответ 200 — сервер наш, тестовый. Всё остальное (404) —
// прогон останавливается, не создав ни одного заказа.
//
// Маршрут отвечает только в разработке, только при APETIT_E2E=1 и только
// на правильный секрет; ничего не читает и не пишет, секрета не выдаёт.
import { isTestOrderRequest, TEST_HEADER } from "@/server/orders/test-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!isTestOrderRequest(request.headers.get(TEST_HEADER))) {
    return new Response(null, { status: 404 });
  }
  return Response.json({ ok: true, mode: "e2e" });
}
