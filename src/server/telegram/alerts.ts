// Напоминания о непринятом заказе (SPEC §4.3), числа — src/config/alerts.json,
// отсчёт от created_at заказа. Две независимые дорожки:
//   точке     — «⏰ Comanda #N așteaptă — X minute» каждые reminderEvery
//               минут, не больше reminderMax раз (2 × 15 = до 30 минут);
//   владельцам — с ownerAt минут, дальше каждые ownerRepeatEvery, всего
//               ownerMax раз.
// В одну минуту дорожки могут совпасть (12-я минута) — тогда уходят обе.
// Ступень срабатывает, когда «прошло ≥ N минут и она ещё не выполнена» —
// опоздавший cron её не пропустит и дважды не отправит; за тик каждая
// дорожка двигается на один шаг, поэтому после долгого простоя не будет
// залпа. «Am preluat» ставит status=accepted — заказ выпадает из кандидатов,
// а начатую ступень отменяет условный UPDATE в claimStage. Зовётся раз в
// минуту: pg_cron → pg_net → POST /api/telegram/reminders (и telegram-dev).
import { getPoint as getRealPoint, type Point } from "@/data/points";
import type { AlertsConfig } from "@/config/alerts";
import { formatPhoneDisplay } from "@/lib/order/phone";
import type { TelegramApi } from "./api";
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
