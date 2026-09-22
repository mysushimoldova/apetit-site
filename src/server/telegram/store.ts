// Запросы к базе для Telegram: чаты точек и владельцев, коды привязки,
// заказ по id, «Принят», результат отправки, напоминания. Только запросы —
// решения принимают notify.ts / updates.ts / reminders.ts. В unit-тестах —
// fake store с той же формой.
import type { DbClient } from "@/server/db/supabase";
import type { OrderRow } from "@/server/db/types";
import { fail } from "@/server/orders/store";

export interface PointChat {
  chatId: number;
  title: string | null;
}

export interface LinkCode {
  kind: "point" | "owner";
  pointId: string | null;
  label: string;
}

export type StoredOrder = Pick<
  OrderRow,
  | "id"
  | "number"
  | "point_id"
  | "name"
  | "phone"
  | "address"
  | "items"
  | "total"
  | "status"
  | "created_at"
  | "accepted_at"
  | "telegram_message_id"
>;

/** Непринятый заказ со счётчиками ступеней (см. alerts.ts) */
export interface PendingAlert {
  id: string;
  number: number;
  pointId: string;
  createdAt: string;
  remindersSent: number;
  ownerAlertsSent: number;
}

export type AlertStage = "reminder" | "owner";

export interface TelegramStore {
  pointChat(pointId: string): Promise<PointChat | null>;
  ownerChats(): Promise<number[]>;
  findCode(code: string): Promise<LinkCode | null>;
  linkPoint(
    pointId: string,
    chatId: number,
    title: string | null,
  ): Promise<void>;
  linkOwner(chatId: number, label: string | null): Promise<void>;
  orderById(id: string): Promise<StoredOrder | null>;
  /** status new → accepted; null — уже был принят (или нет такого) */
  acceptOrder(id: string, at: Date): Promise<StoredOrder | null>;
  /** Сообщение ушло (id) или нет (текст ошибки) */
  setTelegramResult(
    id: string,
    result: { messageId: number | null; error: string | null },
  ): Promise<void>;
  /**
   * Новые заказы старше olderThanMin минут, у которых ещё не пройдена хотя бы
   * одна дорожка: напоминаний меньше reminderMax или сообщений владельцам
   * меньше ownerMax. pointId — только для тестов (свои заказы).
   */
  pendingAlerts(
    now: Date,
    olderThanMin: number,
    reminderMax: number,
    ownerMax: number,
    pointId?: string,
  ): Promise<PendingAlert[]>;
  /**
   * Атомарно «забрать» ступень: счётчик ступени поднимается, только если он
   * ещё равен expected и заказ всё ещё new. false — уже забрали параллельно
   * или заказ приняли.
   */
  claimStage(
    id: string,
    stage: AlertStage,
    expected: number,
    now: Date,
  ): Promise<boolean>;
}

const ORDER_COLUMNS =
  "id, number, point_id, name, phone, address, items, total, status, created_at, accepted_at, telegram_message_id";

export function createSupabaseTelegramStore(
  getDb: () => DbClient,
): TelegramStore {
  return {
    async pointChat(pointId) {
      const { data, error } = await getDb()
        .from("telegram_chats")
        .select("chat_id, title")
        .eq("point_id", pointId)
        .maybeSingle();
      if (error) fail("pointChat", error);
      return data ? { chatId: data.chat_id, title: data.title } : null;
    },

    async ownerChats() {
      const { data, error } = await getDb()
        .from("owner_chats")
        .select("chat_id");
      if (error) fail("ownerChats", error);
      return (data ?? []).map((r) => r.chat_id);
    },

    async findCode(code) {
      const { data, error } = await getDb()
        .from("telegram_codes")
        .select("kind, point_id, label")
        .eq("code", code)
        .maybeSingle();
      if (error) fail("findCode", error);
      return data
        ? { kind: data.kind, pointId: data.point_id, label: data.label }
        : null;
    },

    async linkPoint(pointId, chatId, title) {
      const { error } = await getDb().from("telegram_chats").upsert(
        {
          point_id: pointId,
          chat_id: chatId,
          title,
          linked_at: new Date().toISOString(),
        },
        { onConflict: "point_id" },
      );
      if (error) fail("linkPoint", error);
    },

    async linkOwner(chatId, label) {
      const { error } = await getDb()
        .from("owner_chats")
        .upsert(
          { chat_id: chatId, label, linked_at: new Date().toISOString() },
          { onConflict: "chat_id" },
        );
      if (error) fail("linkOwner", error);
    },

    async orderById(id) {
      const { data, error } = await getDb()
        .from("orders")
        .select(ORDER_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (error) fail("orderById", error);
      return data;
    },

    async acceptOrder(id, at) {
      const { data, error } = await getDb()
        .from("orders")
        .update({ status: "accepted", accepted_at: at.toISOString() })
        .eq("id", id)
        .eq("status", "new")
        .select(ORDER_COLUMNS)
        .maybeSingle();
      if (error) fail("acceptOrder", error);
      return data;
    },

    async setTelegramResult(id, result) {
      const { error } = await getDb()
        .from("orders")
        .update({
          telegram_message_id: result.messageId,
          telegram_error: result.error,
        })
        .eq("id", id);
      if (error) fail("setTelegramResult", error);
    },

    async pendingAlerts(now, olderThanMin, reminderMax, ownerMax, pointId) {
      let query = getDb()
        .from("orders")
        .select(
          "id, number, point_id, created_at, reminders_sent, owner_alerts_sent",
        )
        .eq("status", "new")
        .lte(
          "created_at",
          new Date(now.getTime() - olderThanMin * 60_000).toISOString(),
        )
        // Хотя бы одна дорожка не пройдена
        .or(`reminders_sent.lt.${reminderMax},owner_alerts_sent.lt.${ownerMax}`)
        .order("created_at");
      if (pointId) query = query.eq("point_id", pointId);
      const { data, error } = await query;
      if (error) fail("pendingAlerts", error);
      return (data ?? []).map((r) => ({
        id: r.id,
        number: r.number,
        pointId: r.point_id,
        createdAt: r.created_at,
        remindersSent: r.reminders_sent,
        ownerAlertsSent: r.owner_alerts_sent,
      }));
    },

    async claimStage(id, stage, expected, now) {
      const at = now.toISOString();
      const column =
        stage === "reminder" ? "reminders_sent" : "owner_alerts_sent";
      const patch =
        stage === "reminder"
          ? { reminders_sent: expected + 1, last_reminder_at: at }
          : { owner_alerts_sent: expected + 1, last_owner_alert_at: at };
      const { data, error } = await getDb()
        .from("orders")
        .update(patch)
        .eq("id", id)
        .eq("status", "new")
        .eq(column, expected)
        .select("id");
      if (error) fail("claimStage", error);
      return (data ?? []).length === 1;
    },
  };
}
