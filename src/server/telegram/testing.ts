// Подмены для unit-тестов Telegram (только тесты, приложение не импортирует):
// fake Bot API, который записывает вызовы, и fake store на массивах с той же
// формой, что настоящий. Заказы в fake store — по одной строке на заказ.
import type { Point } from "@/data/points";
import type { InlineKeyboard, TelegramApi } from "./api";
import type { StoredOrder, TelegramStore } from "./store";

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
  /** Чаты, отправка в которые всегда падает (сбой у одного адресата) */
  failChats: Set<number>;
}

export function fakeApi(): FakeApi {
  let nextId = 100;
  const api: FakeApi = {
    sent: [],
    edited: [],
    answered: [],
    failNext: 0,
    failChats: new Set(),
    async sendMessage(params) {
      if (api.failChats.has(params.chatId)) {
        throw new Error("sendMessage: 403 Forbidden: bot was blocked");
      }
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
      /** Заказ из прогона тестов (0005): напоминаний не получает */
      is_test: boolean;
      reminders_sent: number;
      last_reminder_at: string | null;
      telegram_error: string | null;
      owner_alerts_sent: number;
      last_owner_alert_at: string | null;
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
    async pendingAlerts(now, olderThanMin, reminderMax, ownerMax, pointId) {
      return [...store.orders.values()]
        .filter(
          (o) =>
            o.status === "new" &&
            !o.is_test &&
            (!pointId || o.point_id === pointId) &&
            new Date(o.created_at).getTime() <=
              now.getTime() - olderThanMin * 60_000 &&
            (o.reminders_sent < reminderMax || o.owner_alerts_sent < ownerMax),
        )
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((o) => ({
          id: o.id,
          number: o.number,
          pointId: o.point_id,
          createdAt: o.created_at,
          remindersSent: o.reminders_sent,
          ownerAlertsSent: o.owner_alerts_sent,
          delivered: o.telegram_message_id !== null,
        }));
    },
    async claimStage(id, stage, expected, now) {
      const o = store.orders.get(id);
      if (!o || o.status !== "new") return false;
      if (stage === "reminder") {
        if (o.reminders_sent !== expected) return false;
        o.reminders_sent++;
        o.last_reminder_at = now.toISOString();
      } else {
        if (o.owner_alerts_sent !== expected) return false;
        o.owner_alerts_sent++;
        o.last_owner_alert_at = now.toISOString();
      }
      return true;
    },
    async releaseStage(id, stage, expected) {
      const o = store.orders.get(id);
      if (!o || o.status !== "new") return;
      if (stage === "reminder") {
        if (o.reminders_sent === expected + 1) o.reminders_sent = expected;
      } else {
        if (o.owner_alerts_sent === expected + 1) {
          o.owner_alerts_sent = expected;
        }
      }
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
  placeId: "ChIJ2YI2WgBzM0cRVzCmzQHNyfQ",
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
    is_test: false,
    reminders_sent: 0,
    last_reminder_at: null,
    telegram_error: null,
    owner_alerts_sent: 0,
    last_owner_alert_at: null,
    ...over,
  };
}
