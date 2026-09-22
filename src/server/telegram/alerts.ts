// Напоминания о непринятом заказе (SPEC §4.3), числа — src/config/alerts.json,
// отсчёт от created_at заказа. Две независимые дорожки:
//   точке     — «⏰ Comanda #N așteaptă — X minute» каждые reminderEvery
//               минут, не больше reminderMax раз (2 × 15 = до 30 минут);
//   владельцам — с ownerAt минут, дальше каждые ownerRepeatEvery, всего
//               ownerMax раз.
// В одну минуту дорожки могут совпасть (12-я минута) — тогда уходят обе.
// Отдельный случай: карточка заказа вообще не дошла до точки (Telegram
// молчал при приёме заказа, orders.telegram_message_id = null). Тогда
// первое же напоминание шлёт не «⏰ #N ждёт», а саму карточку с кнопкой —
// иначе кассир видит номер заказа, но не знает ни состава, ни телефона
// клиента и не может его принять. Лестница при этом работает как повтор:
// не вышло сейчас — попробует через reminderEvery минут.
// Ступень срабатывает, когда «прошло ≥ N минут и она ещё не выполнена» —
// опоздавший cron её не пропустит и дважды не отправит; за тик каждая
// дорожка двигается на один шаг, поэтому после долгого простоя не будет
// залпа. «Am preluat» ставит status=accepted — заказ выпадает из кандидатов,
// а начатую ступень отменяет условный UPDATE в claimStage. Зовётся раз в
// минуту: pg_cron → pg_net → POST /api/telegram/reminders (и telegram-dev).
import { getPoint as getRealPoint, type Point } from "@/data/points";
import type { AlertsConfig } from "@/config/alerts";
import { formatPhoneDisplay } from "@/lib/order/phone";
import { ReceiptLineSchema } from "@/lib/order/receipt";
import { z } from "@/lib/zod";
import type { TelegramApi } from "./api";
import { acceptCallbackData, orderMessage } from "./message";
import type { AlertStage, PendingAlert, TelegramStore } from "./store";
import { BOT_TEXTS } from "./texts";

export interface DueStage {
  stage: AlertStage;
  /** Номер сообщения этой дорожки: 1..reminderMax / 1..ownerMax */
  n: number;
  /** Текущее значение счётчика — для условного UPDATE */
  expected: number;
}

export type StageCounters = Pick<
  PendingAlert,
  "remindersSent" | "ownerAlertsSent"
>;

/** Какие ступени пора слать заказу, которому elapsedMin минут (0, 1 или 2). */
export function dueStages(
  order: StageCounters,
  elapsedMin: number,
  cfg: AlertsConfig,
): DueStage[] {
  const due: DueStage[] = [];
  const reminderDue = cfg.reminderEvery * (order.remindersSent + 1);
  if (order.remindersSent < cfg.reminderMax && elapsedMin >= reminderDue) {
    due.push({
      stage: "reminder",
      n: order.remindersSent + 1,
      expected: order.remindersSent,
    });
  }
  const ownerDue = cfg.ownerAt + order.ownerAlertsSent * cfg.ownerRepeatEvery;
  if (order.ownerAlertsSent < cfg.ownerMax && elapsedMin >= ownerDue) {
    due.push({
      stage: "owner",
      n: order.ownerAlertsSent + 1,
      expected: order.ownerAlertsSent,
    });
  }
  return due;
}

export interface AlertDeps {
  api: TelegramApi | null;
  store: TelegramStore;
  config: AlertsConfig;
  log: (message: string, data: Record<string, unknown>) => void;
  getPoint?: (id: string) => Point | undefined;
}

export interface AlertRun {
  /** Кандидатов (новых заказов старше reminderEvery) */
  pending: number;
  /** Сообщений отправлено, по дорожкам */
  sent: Record<AlertStage, number>;
  failed: number;
}

function elapsedMinutes(createdAt: string, now: Date): number {
  return (now.getTime() - new Date(createdAt).getTime()) / 60_000;
}

/** Снимок позиций как он лежит в базе; битый (не должно быть) — null. */
const StoredLinesSchema = z.array(ReceiptLineSchema).min(1);

/**
 * Карточка заказа из базы — для повторной отправки, когда первая не дошла.
 * null — заказа уже нет или снимок позиций не читается.
 */
async function cardFor(
  id: string,
  pointName: string,
  deps: { store: TelegramStore },
) {
  const order = await deps.store.orderById(id);
  if (!order) return null;
  const lines = StoredLinesSchema.safeParse(order.items);
  if (!lines.success) return null;
  return {
    number: order.number,
    pointName,
    name: order.name,
    phone: order.phone,
    address: order.address,
    lines: lines.data,
    total: order.total,
    createdAt: order.created_at,
  };
}

export async function processAlerts(
  now: Date,
  deps: AlertDeps,
  pointId?: string,
): Promise<AlertRun> {
  const cfg = deps.config;
  const run: AlertRun = {
    pending: 0,
    sent: { reminder: 0, owner: 0 },
    failed: 0,
  };
  // Кандидат перестаёт им быть, когда обе дорожки пройдены до конца
  const pending = await deps.store.pendingAlerts(
    now,
    cfg.reminderEvery,
    cfg.reminderMax,
    cfg.ownerMax,
    pointId,
  );
  run.pending = pending.length;
  const due = pending.flatMap((order) => {
    const elapsed = elapsedMinutes(order.createdAt, now);
    return dueStages(order, elapsed, cfg).map((stage) => ({
      order,
      stage,
      minutes: Math.floor(elapsed),
    }));
  });
  if (due.length === 0) return run;
  if (!deps.api) {
    deps.log("alerts skipped: TELEGRAM_BOT_TOKEN not set", { due: due.length });
    return run;
  }
  const api = deps.api;

  // Заказы и дорожки — параллельно: один медленный чат не задержит остальные
  await Promise.all(
    due.map(async ({ order, stage, minutes }) => {
      const meta = {
        number: order.number,
        point: order.pointId,
        stage: stage.stage,
        n: stage.n,
      };
      try {
        const claimed = await deps.store.claimStage(
          order.id,
          stage.stage,
          stage.expected,
          now,
        );
        if (!claimed) return; // приняли или уже отправил параллельный запуск
        const point = (deps.getPoint ?? getRealPoint)(order.pointId);
        const lang = point?.locale ?? "ro";
        const t = BOT_TEXTS[lang];

        if (stage.stage === "owner") {
          const owners = await deps.store.ownerChats();
          const text = t.ownerAlert(
            point?.name ?? order.pointId,
            order.number,
            minutes,
            point ? formatPhoneDisplay(point.phone) : "",
          );
          for (const chatId of owners) {
            await api.sendMessage({ chatId, text });
          }
          run.sent.owner++;
          deps.log("owner alert sent", { ...meta, owners: owners.length });
          return;
        }

        const chat = await deps.store.pointChat(order.pointId);
        if (!chat) throw new Error(`point not linked: ${order.pointId}`);

        // Карточка так и не дошла (Telegram молчал при приёме заказа):
        // напоминать «#N ждёт» нечем — точка не видела ни состава, ни
        // кнопки. Шлём саму карточку заново, с кнопкой; получилось —
        // записываем message_id, и дальше идут обычные напоминания.
        if (!order.delivered) {
          const card = await cardFor(order.id, point?.name ?? order.pointId, {
            store: deps.store,
          });
          if (card) {
            const { messageId } = await api.sendMessage({
              chatId: chat.chatId,
              text: orderMessage(card, lang),
              replyMarkup: {
                inline_keyboard: [
                  [
                    {
                      text: t.accept,
                      callback_data: acceptCallbackData(order.id),
                    },
                  ],
                ],
              },
            });
            await deps.store.setTelegramResult(order.id, {
              messageId,
              error: null,
            });
            run.sent.reminder++;
            deps.log("order card resent", meta);
            return;
          }
          // Заказа в базе уже нет или снимок битый — шлём обычное напоминание
          deps.log("order card resend: no snapshot", meta);
        }

        await api.sendMessage({
          chatId: chat.chatId,
          text: t.reminder(order.number, minutes),
        });
        run.sent.reminder++;
        deps.log("reminder sent", meta);
      } catch (error) {
        run.failed++;
        deps.log(`${stage.stage} failed`, {
          ...meta,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );
  return run;
}
