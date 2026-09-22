// Будильник лестницы напоминаний (SPEC §4.3): раз в минуту сюда стучится
// pg_cron через pg_net (в разработке — scripts/telegram-dev.mjs) с
// заголовком X-Reminders-Secret = REMINDERS_SECRET. Чужой запрос → 401.
// Частые вызовы безопасны: ступень «забирается» условным UPDATE в базе.
// Одна серия тревоги — 3 сообщения с паузой 5 с ≈ 11–12 с; заказы идут
// параллельно, так что запрос не длиннее одной серии (лимит Workers — 30 с).
import { alertsConfig } from "@/config/alerts";
import {
  getTelegramApi,
  getTelegramStore,
  telegramLog,
} from "@/server/telegram";
import { processAlerts } from "@/server/telegram/alerts";
import { secretMatches } from "@/server/telegram/secret";

export async function POST(request: Request): Promise<Response> {
  const secret = request.headers.get("x-reminders-secret");
  if (!secretMatches(secret, process.env.REMINDERS_SECRET)) {
    return new Response(null, { status: 401 });
  }
  try {
    const run = await processAlerts(new Date(), {
      api: getTelegramApi(),
      store: getTelegramStore(),
      config: alertsConfig,
      log: telegramLog,
    });
    return Response.json({ ok: true, ...run });
  } catch (error) {
    telegramLog("alerts failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ ok: false }, { status: 500 });
  }
}
