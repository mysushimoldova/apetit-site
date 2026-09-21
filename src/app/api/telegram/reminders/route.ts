// Будильник напоминаний (SPEC §4.3): раз в минуту сюда стучится pg_cron
// через pg_net (в разработке — scripts/telegram-dev.mjs) с заголовком
// X-Reminders-Secret = REMINDERS_SECRET. Чужой запрос → 401. Частые вызовы
// безопасны: кому пора — решает база и поднимает счётчик тем же запросом.
import {
  getTelegramApi,
  getTelegramStore,
  telegramLog,
} from "@/server/telegram";
import { processReminders } from "@/server/telegram/reminders";
import { secretMatches } from "@/server/telegram/secret";

export async function POST(request: Request): Promise<Response> {
  const secret = request.headers.get("x-reminders-secret");
  if (!secretMatches(secret, process.env.REMINDERS_SECRET)) {
    return new Response(null, { status: 401 });
  }
  try {
    const run = await processReminders(new Date(), {
      api: getTelegramApi(),
      store: getTelegramStore(),
      log: telegramLog,
    });
    return Response.json({ ok: true, ...run });
  } catch (error) {
    telegramLog("reminders failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ ok: false }, { status: 500 });
  }
}
