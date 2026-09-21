// Напоминания (SPEC §4.3): заказ status='new' не принят 2 минуты → в чат
// точки «⏰ Comanda 1042 așteaptă», до 5 раз с шагом 2 минуты. Кто и когда
// пора — решает база (claim_due_reminders поднимает счётчик тем же UPDATE),
// поэтому частые или параллельные вызовы ничего не дублируют. Зовётся
// раз в минуту: pg_cron → pg_net → POST /api/telegram/reminders.
import { getPoint as getRealPoint, type Point } from "@/data/points";
import type { TelegramApi } from "./api";
import { reminderMessage } from "./message";
import type { TelegramStore } from "./store";

export const REMINDER_INTERVAL_MS = 2 * 60_000;
export const REMINDER_MAX = 5;

export interface ReminderDeps {
  api: TelegramApi | null;
  store: TelegramStore;
  log: (message: string, data: Record<string, unknown>) => void;
  getPoint?: (id: string) => Point | undefined;
}

export interface ReminderRun {
  due: number;
  sent: number;
}

export async function processReminders(
  now: Date,
  deps: ReminderDeps,
): Promise<ReminderRun> {
  const due = await deps.store.claimDueReminders(
    now,
    REMINDER_INTERVAL_MS,
    REMINDER_MAX,
  );
  let sent = 0;
  if (due.length === 0) return { due: 0, sent };
  if (!deps.api) {
    deps.log("reminders skipped: TELEGRAM_BOT_TOKEN not set", {
      due: due.length,
    });
    return { due: due.length, sent };
  }
  for (const order of due) {
    const meta = {
      number: order.number,
      point: order.pointId,
      n: order.remindersSent,
    };
    try {
      const chat = await deps.store.pointChat(order.pointId);
      if (!chat) throw new Error(`point not linked: ${order.pointId}`);
      const lang =
        (deps.getPoint ?? getRealPoint)(order.pointId)?.locale ?? "ro";
      await deps.api.sendMessage({
        chatId: chat.chatId,
        text: reminderMessage(order.number, lang),
      });
      sent++;
      deps.log("reminder sent", meta);
    } catch (error) {
      deps.log("reminder failed", {
        ...meta,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { due: due.length, sent };
}
