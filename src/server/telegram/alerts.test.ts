import { beforeEach, describe, expect, it, vi } from "vitest";
import { alertsConfig, AlertsConfigSchema } from "@/config/alerts";
import { dueStages, processAlerts, type AlertDeps } from "./alerts";
import { fakeApi, fakeStore, storedOrder, TEST_POINT } from "./testing";
import { BOT_TEXTS, roMinutes, ruMinutes } from "./texts";

const CREATED = new Date("2026-09-19T07:30:00Z"); // 10:30 по Кишинёву
const at = (min: number) => new Date(CREATED.getTime() + min * 60_000);

let api: ReturnType<typeof fakeApi>;
let store: ReturnType<typeof fakeStore>;
let deps: AlertDeps;
beforeEach(() => {
  api = fakeApi();
  store = fakeStore();
  deps = {
    api,
    store,
    config: alertsConfig,
    log: vi.fn(),
    getPoint: (id) => (id === "briceni" ? TEST_POINT : undefined),
  };
  store.chats.set("briceni", { chatId: 5001, title: "Briceni" });
  store.owners.set(9001, "Amian");
  store.owners.set(9002, "Părinți");
  store.orders.set(
    storedOrder().id,
    storedOrder({ created_at: CREATED.toISOString() }),
  );
});

/**
 * Тик cron в минуту m. Дорожки идут параллельно, поэтому порядок внутри
 * одного тика не гарантирован — сортируем по чату (точка 5001, владельцы 9xxx).
 */
async function tick(m: number) {
  const before = api.sent.length;
  const run = await processAlerts(at(m), deps);
  const messages = api.sent.slice(before).sort((a, b) => a.chatId - b.chatId);
  return { run, messages };
}

/** ⏰ — напоминание точке, ⚠️ — сообщение владельцу (по первому знаку текста) */
const kinds = (messages: { text: string }[]) =>
  messages.map((m) => (m.text.startsWith("⏰") ? "⏰" : "⚠️")).join("");

/** Счётчики заказа как их видит dueStages */
function counters(id = storedOrder().id) {
  const o = store.orders.get(id)!;
  return {
    remindersSent: o.reminders_sent,
    ownerAlertsSent: o.owner_alerts_sent,
  };
}

describe("alerts.json — числа схемы Амяна", () => {
  it("значения из задания и проверка схемы", () => {
    expect(alertsConfig).toEqual({
      reminderEvery: 2,
      reminderMax: 15,
      ownerAt: 12,
      ownerRepeatEvery: 10,
      ownerMax: 3,
    });
    // Напоминания точке — до 30 минут
    expect(alertsConfig.reminderEvery * alertsConfig.reminderMax).toBe(30);
    expect(
      AlertsConfigSchema.safeParse({ ...alertsConfig, reminderEvery: 0 })
        .success,
    ).toBe(false);
    expect(
      AlertsConfigSchema.safeParse({ ...alertsConfig, ownerMax: -1 }).success,
    ).toBe(false);
  });
});

describe("dueStages — что пора слать по времени (таблица минут)", () => {
  it.each([
    [1, []],
    [2, ["reminder 1"]],
    [3, []],
    [5, []],
    [6, ["reminder 3"]],
    [10, ["reminder 5"]],
    [12, ["reminder 6", "owner 1"]],
    [22, ["reminder 11", "owner 2"]],
    [32, ["owner 3"]],
    [45, []],
    [60, []],
  ])("минута %s → %s", async (minute, expected) => {
    // Доводим счётчики тиками по минуте до minute-1, потом смотрим саму минуту
    for (let m = 1; m < minute; m++) await processAlerts(at(m), deps);
    expect(
      dueStages(counters(), minute, alertsConfig).map(
        (d) => `${d.stage} ${d.n}`,
      ),
    ).toEqual(expected);
  });

  it("тик каждую минуту 1..60: напоминания каждые 2 минуты до 30-й (15 штук), владельцам на 12, 22, 32", async () => {
    const log: string[] = [];
    for (let m = 1; m <= 60; m++) {
      const { messages } = await tick(m);
      if (messages.length) {
        log.push(`${m}: ${kinds(messages)}`);
      }
    }
    expect(log).toEqual([
      "2: ⏰",
      "4: ⏰",
      "6: ⏰",
      "8: ⏰",
      "10: ⏰",
      "12: ⏰⚠️⚠️", // напоминание точке + сообщение двум владельцам
      "14: ⏰",
      "16: ⏰",
      "18: ⏰",
      "20: ⏰",
      "22: ⏰⚠️⚠️",
      "24: ⏰",
      "26: ⏰",
      "28: ⏰",
      "30: ⏰",
      "32: ⚠️⚠️",
    ]);
    expect(store.orders.get(storedOrder().id)).toMatchObject({
      reminders_sent: 15,
      owner_alerts_sent: 3,
      last_reminder_at: at(30).toISOString(),
      last_owner_alert_at: at(32).toISOString(),
    });
    // После 32-й минуты заказ больше не кандидат
    expect((await tick(40)).run.pending).toBe(0);
  });

  it("в тексте напоминания — сколько прошло минут (ro)", async () => {
    const texts: string[] = [];
    for (let m = 1; m <= 24; m++) {
      const { messages } = await tick(m);
      texts.push(
        ...messages.filter((s) => s.chatId === 5001).map((s) => s.text),
      );
    }
    expect(texts.slice(0, 3)).toEqual([
      "⏰ Comanda #1042 așteaptă — 2 minute",
      "⏰ Comanda #1042 așteaptă — 4 minute",
      "⏰ Comanda #1042 așteaptă — 6 minute",
    ]);
    expect(texts.at(-1)).toBe("⏰ Comanda #1042 așteaptă — 24 de minute");
  });

  it("принят на 7-й минуте → дальше тишина", async () => {
    for (let m = 1; m <= 6; m++) await tick(m);
    expect(api.sent).toHaveLength(3); // напоминания на 2, 4, 6
    await store.acceptOrder(storedOrder().id, at(7));
    for (let m = 7; m <= 60; m++) {
      const { run } = await tick(m);
      expect(run.pending).toBe(0);
    }
    expect(api.sent).toHaveLength(3);
  });

  it("cron опоздал на минуту (пропущены 2-я и 12-я) → ступени не пропадают и не удваиваются", async () => {
    const seen: string[] = [];
    for (const m of [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14]) {
      const { messages } = await tick(m);
      if (messages.length) seen.push(`${m}: ${kinds(messages)}`);
    }
    // Первое напоминание ушло на 3-й минуте (тик 2-й не состоялся), дальше
    // шаг считается от счётчика: 4, 6, 8, 10; на 13-й — шестое и владельцам
    expect(seen).toEqual([
      "3: ⏰",
      "4: ⏰",
      "6: ⏰",
      "8: ⏰",
      "10: ⏰",
      "13: ⏰⚠️⚠️",
      "14: ⏰",
    ]);
    expect(store.orders.get(storedOrder().id)).toMatchObject({
      reminders_sent: 7,
      owner_alerts_sent: 1,
    });
  });

  it("cron лежал долго: догоняет по одному шагу за тик, не залпом", async () => {
    const first = await tick(30);
    expect(first.messages.map((s) => s.text)).toEqual([
      "⏰ Comanda #1042 așteaptă — 30 de minute",
      expect.stringContaining("Au trecut 30 de minute"),
      expect.stringContaining("Au trecut 30 de minute"),
    ]);
    const second = await tick(31);
    expect(kinds(second.messages)).toBe("⏰⚠️⚠️");
    expect(store.orders.get(storedOrder().id)).toMatchObject({
      reminders_sent: 2,
      owner_alerts_sent: 2,
    });
  });
});

describe("processAlerts — тексты и адресаты", () => {
  it("ro: напоминание точке, на 12-й минуте ещё и сообщение обоим владельцам с телефоном точки", async () => {
    for (let m = 1; m <= 12; m++) await tick(m);
    const toPoint = api.sent.filter((s) => s.chatId === 5001);
    expect(toPoint.map((s) => s.text)).toEqual([
      "⏰ Comanda #1042 așteaptă — 2 minute",
      "⏰ Comanda #1042 așteaptă — 4 minute",
      "⏰ Comanda #1042 așteaptă — 6 minute",
      "⏰ Comanda #1042 așteaptă — 8 minute",
      "⏰ Comanda #1042 așteaptă — 10 minute",
      "⏰ Comanda #1042 așteaptă — 12 minute",
    ]);
    expect(api.sent.filter((s) => s.chatId !== 5001)).toEqual([
      {
        chatId: 9001,
        text: "⚠️ Apetit Briceni nu a preluat comanda #1042. Au trecut 12 minute. Tel. punct: 068 372 707",
      },
      {
        chatId: 9002,
        text: "⚠️ Apetit Briceni nu a preluat comanda #1042. Au trecut 12 minute. Tel. punct: 068 372 707",
      },
    ]);
    // Кнопок в напоминаниях нет — она только на карточке заказа
    expect(api.sent.every((s) => s.replyMarkup === undefined)).toBe(true);
  });

  it("ru (Otaci): те же дорожки по-русски, минуты склоняются", async () => {
    const otaci = {
      ...TEST_POINT,
      id: "otaci",
      name: "Apetit Otaci",
      locale: "ru" as const,
      phone: "060123456",
    };
    deps.getPoint = (id) => (id === "otaci" ? otaci : undefined);
    store.chats.set("otaci", { chatId: 5002, title: null });
    store.orders.clear();
    store.orders.set(
      "o2",
      storedOrder({
        id: "o2",
        number: 1043,
        point_id: "otaci",
        created_at: CREATED.toISOString(),
      }),
    );
    for (let m = 1; m <= 22; m++) await tick(m);
    const toPoint = api.sent
      .filter((s) => s.chatId === 5002)
      .map((s) => s.text);
    expect(toPoint[0]).toBe("⏰ Заказ №1043 ждёт — 2 минуты");
    expect(toPoint[2]).toBe("⏰ Заказ №1043 ждёт — 6 минут");
    expect(toPoint.at(-1)).toBe("⏰ Заказ №1043 ждёт — 22 минуты");
    expect(api.sent.find((s) => s.chatId === 9001)?.text).toBe(
      "⚠️ Apetit Otaci не принял заказ №1043. Прошло 12 минут. Тел. точки: 060 123 456",
    );
    expect([1, 2, 5, 11, 21, 22, 25].map(ruMinutes)).toEqual([
      "1 минута",
      "2 минуты",
      "5 минут",
      "11 минут",
      "21 минута",
      "22 минуты",
      "25 минут",
    ]);
    expect([1, 2, 12, 19, 20, 30].map(roMinutes)).toEqual([
      "1 minut",
      "2 minute",
      "12 minute",
      "19 minute",
      "20 de minute",
      "30 de minute",
    ]);
  });

  it("точка не привязана → ошибка в лог, ступень не засчитана; владельцам всё равно уходит", async () => {
    store.chats.delete("briceni");
    const { run } = await tick(2);
    expect(run).toEqual({
      pending: 1,
      sent: { reminder: 0, owner: 0 },
      failed: 1,
    });
    expect(deps.log).toHaveBeenCalledWith(
      "reminder failed",
      expect.objectContaining({
        number: 1042,
        error: "point not linked: briceni",
      }),
    );
    // Ступень вернулась: следующий тик попробует напоминание снова
    expect(counters().remindersSent).toBe(0);
    for (let m = 3; m <= 11; m++) await tick(m);
    const { run: owner } = await tick(12);
    expect(owner.sent.owner).toBe(1);
  });

  it("ошибка на первом чате владельца не отменяет остальных (Н6)", async () => {
    for (let m = 1; m <= 11; m++) await tick(m);
    api.failChats.add(9001); // один из двух владельцев заблокировал бота
    const { run } = await tick(12);
    expect(run.sent.owner).toBe(1);
    expect(run.failed).toBe(0);
    // Второй владелец сообщение получил
    expect(api.sent.filter((s) => s.chatId === 9002)).toHaveLength(1);
    // Ступень пройдена: следующее сообщение владельцам — по расписанию, на 22-й
    expect(counters().ownerAlertsSent).toBe(1);
  });

  it("не ответил ни один чат владельцев → ступень возвращается (Н6 + Н7)", async () => {
    for (let m = 1; m <= 11; m++) await tick(m);
    api.failChats.add(9001);
    api.failChats.add(9002);
    const { run } = await tick(12);
    expect(run.sent.owner).toBe(0);
    expect(run.failed).toBe(1);
    expect(counters().ownerAlertsSent).toBe(0);
    // Следующий тик пробует ту же ступень снова — и она уходит
    api.failChats.clear();
    const again = await tick(13);
    expect(again.run.sent.owner).toBe(1);
    expect(again.messages.map((s) => s.chatId)).toEqual([9001, 9002]);
  });

  it("напоминание не ушло → ступень возвращается, следующий тик повторяет (Н7)", async () => {
    api.failChats.add(5001); // чат точки не отвечает
    const { run } = await tick(2);
    expect(run.failed).toBe(1);
    expect(counters().remindersSent).toBe(0);
    api.failChats.clear();
    const again = await tick(3);
    expect(again.messages.map((s) => s.text)).toEqual([
      "⏰ Comanda #1042 așteaptă — 3 minute",
    ]);
    expect(counters().remindersSent).toBe(1);
  });

  it("лестница кончилась — ступень не возвращается, повторов без конца нет", async () => {
    store.chats.delete("briceni"); // точку так и не привязали
    // Последнее напоминание — на 30-й минуте (reminderEvery × reminderMax)
    const late = await tick(31);
    expect(late.run.failed).toBe(1);
    expect(counters().remindersSent).toBe(1);
  });

  it("нет токена → ничего не отправлено и счётчики не тронуты", async () => {
    const run = await processAlerts(at(5), { ...deps, api: null });
    expect(run.pending).toBe(1);
    expect(store.orders.get(storedOrder().id)!.reminders_sent).toBe(0);
  });

  it("два параллельных запуска — ступень уходит один раз", async () => {
    await Promise.all([processAlerts(at(2), deps), processAlerts(at(2), deps)]);
    expect(api.sent).toHaveLength(1);
  });

  it("в текстах бота нет < и >", () => {
    for (const lang of ["ro", "ru"] as const) {
      const t = BOT_TEXTS[lang];
      const strings = [
        ...Object.values(t).filter((v): v is string => typeof v === "string"),
        t.reminder(1042, 2),
        t.ownerAlert("Apetit", 1042, 12, "067 578 757"),
        t.pointLinked("Apetit"),
      ];
      for (const text of strings) expect(text).not.toMatch(/[<>]/);
    }
  });
});

// Telegram молчал при приёме заказа: карточка до точки не дошла, в базе
// telegram_message_id = null. Напоминание «#N ждёт» кассиру бесполезно —
// он не знает ни состава, ни телефона клиента и не может нажать «Принял».
describe("processAlerts — карточка не дошла до точки", () => {
  beforeEach(() => {
    store.orders.set(
      storedOrder().id,
      storedOrder({
        created_at: CREATED.toISOString(),
        telegram_message_id: null,
        telegram_error: "sendMessage: 502 Bad Gateway",
      }),
    );
  });

  it("первое напоминание шлёт саму карточку с кнопкой, а не «#N ждёт»", async () => {
    const { messages } = await tick(2);
    expect(messages).toHaveLength(1);
    const card = messages[0];
    expect(card.chatId).toBe(5001);
    expect(card.text).toContain("<b>COMANDĂ NOUĂ #1042</b>");
    expect(card.text).toContain("Ion");
    expect(card.text).toContain("+373 68 123 456");
    expect(card.text).toContain("Coca-Cola");
    expect(card.text).toContain("<b>TOTAL: 22 lei</b>");
    expect(card.replyMarkup).toEqual({
      inline_keyboard: [
        [
          {
            text: "✅ Am preluat",
            callback_data: `accept:${storedOrder().id}`,
          },
        ],
      ],
    });
  });

  it("удачная отправка записывает message_id — дальше обычные напоминания", async () => {
    await tick(2);
    expect(store.orders.get(storedOrder().id)).toMatchObject({
      telegram_message_id: 100,
      telegram_error: null,
    });
    const { messages } = await tick(4);
    expect(messages[0].text).toBe("⏰ Comanda #1042 așteaptă — 4 minute");
    expect(messages[0].replyMarkup).toBeUndefined();
  });

  it("Telegram всё ещё лежит — следующая ступень пробует карточку снова", async () => {
    api.failNext = 1;
    const { run } = await tick(2);
    expect(run.failed).toBe(1);
    expect(api.sent).toHaveLength(0);
    // Ступень израсходована, но заказ остался «недоставленным»
    expect(store.orders.get(storedOrder().id)!.telegram_message_id).toBeNull();
    const { messages } = await tick(4);
    expect(messages[0].text).toContain("<b>COMANDĂ NOUĂ #1042</b>");
    expect(messages[0].replyMarkup).toBeDefined();
  });

  it("кнопка на повторной карточке принимает заказ", async () => {
    await tick(2);
    const accepted = await store.acceptOrder(storedOrder().id, at(3));
    expect(accepted?.status).toBe("accepted");
    // Принят — лестница молчит
    const { messages } = await tick(4);
    expect(messages).toHaveLength(0);
  });

  it("ru (Otaci): карточка по-русски", async () => {
    const otaci = {
      ...TEST_POINT,
      id: "otaci",
      name: "Apetit Otaci",
      locale: "ru" as const,
    };
    deps.getPoint = (id) => (id === "otaci" ? otaci : undefined);
    store.chats.set("otaci", { chatId: 5002, title: null });
    store.orders.clear();
    store.orders.set(
      "o2",
      storedOrder({
        id: "o2",
        point_id: "otaci",
        created_at: CREATED.toISOString(),
        telegram_message_id: null,
      }),
    );
    const { messages } = await tick(2);
    expect(messages[0].text).toContain("<b>НОВЫЙ ЗАКАЗ #1042</b>");
    expect(messages[0].text).toContain("<b>ИТОГО: 22 лей</b>");
    expect(messages[0].replyMarkup?.inline_keyboard[0][0].text).toBe(
      "✅ Принял",
    );
  });

  it("заказа в базе уже нет — уходит обычное напоминание, без падения", async () => {
    const pendingOnly = {
      ...deps,
      store: {
        ...store,
        orderById: async () => null,
      },
    };
    const run = await processAlerts(at(2), pendingOnly);
    expect(run.failed).toBe(0);
    expect(api.sent[0].text).toBe("⏰ Comanda #1042 așteaptă — 2 minute");
    expect(deps.log).toHaveBeenCalledWith(
      "order card resend: no snapshot",
      expect.objectContaining({ number: 1042 }),
    );
  });

  it("снимок позиций битый — тоже обычное напоминание", async () => {
    store.orders.set(
      storedOrder().id,
      storedOrder({
        created_at: CREATED.toISOString(),
        telegram_message_id: null,
        items: [{ каша: true }] as unknown as never,
      }),
    );
    const run = await processAlerts(at(2), deps);
    expect(run.failed).toBe(0);
    expect(api.sent[0].text).toBe("⏰ Comanda #1042 așteaptă — 2 minute");
  });

  it("заказ уже старый (ступени шли) — карточка всё равно уходит", async () => {
    store.orders.set(
      storedOrder().id,
      storedOrder({
        created_at: CREATED.toISOString(),
        telegram_message_id: null,
        reminders_sent: 4,
        owner_alerts_sent: 1,
      }),
    );
    const { messages } = await tick(10);
    const card = messages.find((m) => m.chatId === 5001)!;
    expect(card.text).toContain("<b>COMANDĂ NOUĂ #1042</b>");
    expect(card.replyMarkup).toBeDefined();
  });
});
