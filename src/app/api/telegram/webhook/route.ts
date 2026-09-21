// Webhook Telegram (SPEC §9.4: защищён секретом). Telegram шлёт сюда
// каждое событие с заголовком X-Telegram-Bot-Api-Secret-Token — сверяем с
// TELEGRAM_WEBHOOK_SECRET, чужой запрос → 401 и ничего не делаем.
// 200 — событие обработано или проигнорировано; 500 — наша ошибка,
// Telegram повторит доставку.
import {
  getTelegramApi,
  getTelegramStore,
  telegramLog,
} from "@/server/telegram";
import { secretMatches } from "@/server/telegram/secret";
import { handleUpdate } from "@/server/telegram/updates";

export async function POST(request: Request): Promise<Response> {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!secretMatches(secret, process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response(null, { status: 401 });
  }

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const api = getTelegramApi();
  if (!api) {
    telegramLog("webhook: TELEGRAM_BOT_TOKEN not set", {});
    return Response.json({ ok: false }, { status: 503 });
  }

  try {
    const result = await handleUpdate(update, {
      api,
      store: getTelegramStore(),
      log: telegramLog,
    });
    return Response.json({ ok: true, result });
  } catch (error) {
    telegramLog("webhook failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ ok: false }, { status: 500 });
  }
}
