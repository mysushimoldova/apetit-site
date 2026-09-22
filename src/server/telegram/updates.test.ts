import { beforeEach, describe, expect, it, vi } from "vitest";
import { secretMatches } from "./secret";
import { handleUpdate, type UpdateDeps } from "./updates";
import { fakeApi, fakeStore, storedOrder, TEST_POINT } from "./testing";

const NOW = new Date("2026-09-19T15:45:00Z"); // 18:45 в Кишинёве
const POINT_CHAT = 5001;

let api: ReturnType<typeof fakeApi>;
let store: ReturnType<typeof fakeStore>;
let deps: UpdateDeps;
beforeEach(() => {
  api = fakeApi();
  store = fakeStore();
  store.codes.set("ABCD2345", {
    kind: "point",
    pointId: "briceni",
    label: "Apetit Briceni",
  });
  store.codes.set("OWNER777", {
    kind: "owner",
    pointId: null,
    label: "Proprietari",
  });
  deps = {
    api,
    store,
    log: vi.fn(),
    now: () => NOW,
    getPoint: (id) => (id === "briceni" ? TEST_POINT : undefined),
  };
});

const message = (text: string, chatId = 777) => ({
  update_id: 1,
  message: {
    message_id: 1,
    chat: { id: chatId, type: "private", first_name: "Casa" },
    text,
  },
});

const callback = (data: string, chatId = POINT_CHAT) => ({
  update_id: 2,
  callback_query: {
    id: "cb1",
    from: { id: 42, first_name: "Maria" },
    data,
    message: { message_id: 500, chat: { id: chatId, type: "private" } },
  },
});

describe("handleUpdate — /start <код>", () => {
  it("верный код точки → чат записан, ответ «Punct conectat: …»", async () => {
    expect(await handleUpdate(message("/start abcd2345"), deps)).toBe(
      "linked_point",
    );
    expect(store.chats.get("briceni")).toEqual({ chatId: 777, title: "Casa" });
    expect(api.sent).toEqual([
      { chatId: 777, text: "Punct conectat: Apetit Briceni" },
    ]);
  });

  it("точка уже привязана к другому чату → отказ, привязка не меняется; тот же чат — можно повторно", async () => {
    await handleUpdate(message("/start ABCD2345", 777), deps);
    expect(await handleUpdate(message("/start ABCD2345", 999), deps)).toBe(
      "already_linked",
    );
    expect(store.chats.get("briceni")?.chatId).toBe(777);
    expect(api.sent[1].text).toContain("deja conectat");
    expect(await handleUpdate(message("/start ABCD2345", 777), deps)).toBe(
      "linked_point",
    );
  });

  it("код владельца → owner_chats, копии всех заказов", async () => {
    expect(await handleUpdate(message("/start OWNER777", 900), deps)).toBe(
      "linked_owner",
    );
    expect(store.owners.has(900)).toBe(true);
    expect(api.sent[0].text).toContain("Proprietar conectat");
  });

  it("неверный код → «Cod greșit», ничего не записано; в логе нет самого кода", async () => {
    expect(await handleUpdate(message("/start WRONG123"), deps)).toBe(
      "wrong_code",
    );
    expect(store.chats.size).toBe(0);
    expect(api.sent).toEqual([{ chatId: 777, text: "Cod greșit" }]);
    expect(JSON.stringify(vi.mocked(deps.log).mock.calls)).not.toContain(
      "WRONG123",
    );
  });

  it("/start без кода — подсказка; обычный текст и мусор — игнор", async () => {
    expect(await handleUpdate(message("/start"), deps)).toBe("ignored");
    expect(api.sent[0].text).toBe("Trimite: /start COD");
    expect(await handleUpdate(message("salut"), deps)).toBe("ignored");
    expect(await handleUpdate("garbage", deps)).toBe("ignored");
    expect(await handleUpdate({ update_id: 3 }, deps)).toBe("ignored");
    expect(api.sent).toHaveLength(1);
  });
});

describe("handleUpdate — кнопка «Принят»", () => {
  beforeEach(() => {
    store.chats.set("briceni", { chatId: POINT_CHAT, title: "Briceni" });
    store.orders.set(storedOrder().id, storedOrder());
  });

  it("нажатие → status accepted, accepted_at, зелёный заголовок без кнопки, кто принял — в лог", async () => {
    const r = await handleUpdate(callback("accept:" + storedOrder().id), deps);
    expect(r).toBe("accepted");
    const order = store.orders.get(storedOrder().id)!;
    expect(order.status).toBe("accepted");
    expect(order.accepted_at).toBe(NOW.toISOString());
    expect(api.edited).toHaveLength(1);
    expect(api.edited[0]).toMatchObject({ chatId: POINT_CHAT, messageId: 500 });
    expect(api.edited[0].text.split("\n")[0]).toBe(
      "🟢 <b>PRELUATĂ · 18:45 — #1042</b>",
    );
    expect(api.edited[0].text).not.toContain("COMANDĂ NOUĂ");
    expect(api.edited[0].text).toContain("1 × Coca-Cola — 22 lei");
    expect(api.edited[0].text).not.toContain("Primit la");
    expect(api.answered).toEqual([{ id: "cb1", text: undefined }]);
    expect(deps.log).toHaveBeenCalledWith("order accepted by", {
      number: 1042,
      point: "briceni",
      userId: 42,
      user: "Maria",
    });
  });

  it("второе нажатие → «Deja preluată», статус и время не меняются", async () => {
    await handleUpdate(callback("accept:" + storedOrder().id), deps);
    const again = await handleUpdate(callback("accept:" + storedOrder().id), {
      ...deps,
      now: () => new Date("2026-09-19T16:00:00Z"),
    });
    expect(again).toBe("already_accepted");
    expect(store.orders.get(storedOrder().id)!.accepted_at).toBe(
      NOW.toISOString(),
    );
    expect(api.answered[1]).toEqual({ id: "cb1", text: "Deja preluată" });
    // Сообщение всё равно переписано без кнопки, время — первого нажатия
    expect(api.edited[1].text).toContain("🟢 <b>PRELUATĂ · 18:45 — #1042</b>");
  });

  it("нажатие из чужого чата → не принимается", async () => {
    const r = await handleUpdate(
      callback("accept:" + storedOrder().id, 999),
      deps,
    );
    expect(r).toBe("wrong_chat");
    expect(store.orders.get(storedOrder().id)!.status).toBe("new");
    expect(api.edited).toHaveLength(0);
  });

  it("неизвестный заказ и чужие данные кнопки — игнор с ответом на callback", async () => {
    expect(
      await handleUpdate(
        callback("accept:00000000-0000-4000-8000-000000009999"),
        deps,
      ),
    ).toBe("unknown_order");
    expect(await handleUpdate(callback("other:1"), deps)).toBe("ignored");
    expect(api.answered).toHaveLength(2);
  });
});

describe("secretMatches — заголовок webhook", () => {
  it("совпадение → true; отличие, пусто, нет ожидаемого секрета → false", () => {
    expect(secretMatches("abc-123", "abc-123")).toBe(true);
    expect(secretMatches("abc-124", "abc-123")).toBe(false);
    expect(secretMatches("abc-1234", "abc-123")).toBe(false);
    expect(secretMatches("", "abc-123")).toBe(false);
    expect(secretMatches(null, "abc-123")).toBe(false);
    expect(secretMatches("abc-123", undefined)).toBe(false);
    expect(secretMatches("", "")).toBe(false);
  });
});
