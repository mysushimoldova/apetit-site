import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AcceptedOrder } from "@/server/orders/submit";
import { notifyOrder, RETRY_DELAYS_MS } from "./notify";
import { fakeApi, fakeStore, storedOrder, TEST_POINT } from "./testing";

const order: AcceptedOrder = {
  id: storedOrder().id,
  number: 1042,
  point: TEST_POINT,
  lang: "ro",
  name: "Ion",
  phone: "+37368123456",
  address: null,
  lines: storedOrder().items as AcceptedOrder["lines"],
  total: 22,
  createdAt: "2026-09-19T09:00:00.000Z",
};

let api: ReturnType<typeof fakeApi>;
let store: ReturnType<typeof fakeStore>;
let log: ReturnType<
  typeof vi.fn<(m: string, d: Record<string, unknown>) => void>
>;
let sleeps: number[];
const sleep = async (ms: number) => {
  sleeps.push(ms);
};
beforeEach(() => {
  api = fakeApi();
  store = fakeStore();
  log = vi.fn<(m: string, d: Record<string, unknown>) => void>();
  sleeps = [];
  store.orders.set(order.id, storedOrder({ telegram_message_id: null }));
});

describe("notifyOrder — заказ в чат точки и копии владельцам", () => {
  it("точке — текст с кнопкой «✅ Am primit», владельцам — без кнопки; message_id в заказ", async () => {
    store.chats.set("briceni", { chatId: 5001, title: "Briceni" });
    store.owners.set(9001, "Amian");
    store.owners.set(9002, "Părinți");
    await notifyOrder(order, { api, store, log, sleep });
    expect(api.sent).toHaveLength(3);
    expect(api.sent[0].chatId).toBe(5001);
    expect(api.sent[0].text).toContain("<b>COMANDĂ NOUĂ #1042</b>");
    expect(api.sent[0].replyMarkup).toEqual({
      inline_keyboard: [
        [{ text: "✅ Am preluat", callback_data: `accept:${order.id}` }],
      ],
    });
    expect(api.sent[1]).toEqual({ chatId: 9001, text: api.sent[0].text });
    expect(api.sent[2].replyMarkup).toBeUndefined();
    expect(store.orders.get(order.id)).toMatchObject({
      telegram_message_id: 100,
      telegram_error: null,
    });
  });

  it("чат точки записан и как чат владельца → карточка одна, с кнопкой (копия не дублируется)", async () => {
    store.chats.set("briceni", { chatId: 5001, title: "Briceni" });
    store.owners.set(5001, "Amian (тот же чат)");
    store.owners.set(9002, "Părinți");
    await notifyOrder(order, { api, store, log, sleep });
    expect(api.sent.map((m) => [m.chatId, Boolean(m.replyMarkup)])).toEqual([
      [5001, true],
      [9002, false],
    ]);
  });

  it("точка не привязана: копия уходит всем владельцам, включая их собственные чаты", async () => {
    store.owners.set(5001, "Amian");
    await notifyOrder(order, { api, store, log, sleep });
    expect(api.sent.map((m) => m.chatId)).toEqual([5001]);
  });

  it("Telegram дважды не ответил → третья попытка проходит; паузы 1 с и 3 с", async () => {
    store.chats.set("briceni", { chatId: 5001, title: null });
    api.failNext = 2;
    await notifyOrder(order, { api, store, log, sleep });
    expect(api.sent).toHaveLength(1);
    expect(sleeps).toEqual(RETRY_DELAYS_MS);
    expect(store.orders.get(order.id)!.telegram_message_id).toBe(100);
  });

  it("три отказа подряд → telegram_error записан, клиент не страдает (функция не бросает)", async () => {
    store.chats.set("briceni", { chatId: 5001, title: null });
    api.failNext = 3;
    await expect(
      notifyOrder(order, { api, store, log, sleep }),
    ).resolves.toBeUndefined();
    expect(store.orders.get(order.id)).toMatchObject({
      telegram_message_id: null,
      telegram_error: "sendMessage: 502 Bad Gateway",
    });
    expect(log).toHaveBeenCalledWith("telegram failed", {
      number: 1042,
      point: "briceni",
      error: "sendMessage: 502 Bad Gateway",
    });
  });

  it("точка не привязана → ошибка в заказ, владельцы копию всё равно получают", async () => {
    store.owners.set(9001, null);
    await notifyOrder(order, { api, store, log, sleep });
    expect(store.orders.get(order.id)!.telegram_error).toBe(
      "point not linked: briceni",
    );
    expect(api.sent).toEqual([
      { chatId: 9001, text: expect.stringContaining("#1042") },
    ]);
  });

  it("нет токена (api null) → ошибка записана, ничего не отправлено", async () => {
    await notifyOrder(order, { api: null, store, log, sleep });
    expect(store.orders.get(order.id)!.telegram_error).toBe(
      "TELEGRAM_BOT_TOKEN not set",
    );
  });

  it("в логах нет телефона и имени клиента", async () => {
    store.chats.set("briceni", { chatId: 5001, title: null });
    await notifyOrder(order, { api, store, log, sleep });
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain("68123456");
    expect(logged).not.toContain("Ion");
  });
});
