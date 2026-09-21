// Подмены для unit-тестов Telegram (только тесты, приложение не импортирует):
// fake Bot API, который записывает вызовы, и fake store на массивах с той же
// формой, что настоящий. Заказы в fake store — по одной строке на заказ.
import type { Point } from "@/data/points";
import type { InlineKeyboard, TelegramApi } from "./api";
import type { DueReminder, StoredOrder, TelegramStore } from "./store";

export interface SentMessage {
  chatId: number;
  text: string;
  replyMarkup?: InlineKeyboard;
}

export interface FakeApi extends TelegramApi {
  sent: SentMessage[];
  edited: { chatId: number; messageId: number; text: string }[];
  answered: { id: string; text?: string }[];
  /** Сколько ближайших sendMessage должны упасть */
  failNext: number;
}

export function fakeApi(): FakeApi {
  let nextId = 100;
  const api: FakeApi = {
    sent: [],
    edited: [],
    answered: [],
    failNext: 0,
    async sendMessage(params) {
      if (api.failNext > 0) {
        api.failNext--;
        throw new Error("sendMessage: 502 Bad Gateway");
      }
      api.sent.push(params);
      return { messageId: nextId++ };
    },
    async editMessageText(params) {
      api.edited.push(params);
    },
    async answerCallbackQuery(params) {
      api.answered.push(params);
    },
  };
  return api;
}

export interface FakeStore extends TelegramStore {
  chats: Map<string, { chatId: number; title: string | null }>;
  owners: Map<number, string | null>;
  codes: Map<
    string,
    { kind: "point" | "owner"; pointId: string | null; label: string }
  >;
  orders: Map<
    string,
    StoredOrder & {
      reminders_sent: number;
      last_reminder_at: string | null;
      telegram_error: string | null;
    }
  >;
}

export function fakeStore(): FakeStore {
  const store: FakeStore = {
    chats: new Map(),
    owners: new Map(),
    codes: new Map(),
    orders: new Map(),
    async pointChat(pointId) {
      return store.chats.get(pointId) ?? null;
    },
    async ownerChats() {
      return [...store.owners.keys()];
    },
    async findCode(code) {
      return store.codes.get(code) ?? null;
    },
    async linkPoint(pointId, chatId, title) {
      store.chats.set(pointId, { chatId, title });
    },
    async linkOwner(chatId, label) {
      store.owners.set(chatId, label);
    },
    async orderById(id) {
      return store.orders.get(id) ?? null;
    },
    async acceptOrder(id, at) {
      const order = store.orders.get(id);
      if (!order || order.status !== "new") return null;
      order.status = "accepted";
      order.accepted_at = at.toISOString();
      return order;
    },
    async setTelegramResult(id, result) {
      const order = store.orders.get(id);
      if (!order) throw new Error("no such order");
      order.telegram_message_id = result.messageId;
      order.telegram_error = result.error;
    },
    async claimDueReminders(now, intervalMs, max) {
      const due: DueReminder[] = [];
      for (const o of store.orders.values()) {
        const created = new Date(o.created_at).getTime();
        const last = o.last_reminder_at
          ? new Date(o.last_reminder_at).getTime()
          : null;
        if (
          o.status === "new" &&
          created <= now.getTime() - intervalMs &&
          o.reminders_sent < max &&
          (last === null || last <= now.getTime() - intervalMs)
        ) {
          o.reminders_sent++;
          o.last_reminder_at = now.toISOString();
          due.push({
            id: o.id,
            number: o.number,
            pointId: o.point_id,
            remindersSent: o.reminders_sent,
          });
        }
      }
      return due;
    },
  };
  return store;
}

export const TEST_POINT: Point = {
  id: "briceni",
  citySlug: "briceni",
  name: "Apetit Briceni",
  phone: "068372707",
  ownership: "own",
  locale: "ro",
  hours: { open: "08:30", close: "23:00" },
  address: "Str. Test 1",
  acceptingOrders: true,
  coords: null,
};

export function storedOrder(
  over: Partial<
    FakeStore["orders"] extends Map<string, infer V> ? V : never
  > = {},
): FakeStore["orders"] extends Map<string, infer V> ? V : never {
  return {
    id: "00000000-0000-4000-8000-000000001042",
    number: 1042,
    point_id: "briceni",
    name: "Ion",
    phone: "+37368123456",
    address: null,
    items: [
      {
        name: { ro: "Coca-Cola", ru: "Кока-кола" },
        variant: null,
        extra: [],
        cups: [],
        without: [],
        qty: 1,
        unit: 22,
        total: 22,
      },
    ],
    total: 22,
    status: "new",
    created_at: "2026-09-19T09:00:00.000Z",
    accepted_at: null,
    telegram_message_id: 500,
    reminders_sent: 0,
    last_reminder_at: null,
    telegram_error: null,
    ...over,
  };
}
