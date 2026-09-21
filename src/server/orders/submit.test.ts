import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPoint, type Point } from "@/data/points";
import type { CartLine } from "@/lib/cart/lines";
import { StoreError, type NewOrder, type OrderStore } from "./store";
import { submitOrder, type SubmitContext } from "./submit";

/**
 * Подмена базы: массив строк и те же четыре запроса, что делает настоящий
 * store (по dedup_hash, по телефону, по IP, вставка с номером из «sequence»).
 */
function createFakeStore(): OrderStore & {
  rows: (NewOrder & { number: number })[];
} {
  const rows: (NewOrder & { number: number })[] = [];
  let next = 1001;
  const after = (since: Date) => rows.filter((r) => r.createdAt > since);
  return {
    rows,
    async findRecent(dedupHash, since) {
      const hit = after(since)
        .filter((r) => r.dedupHash === dedupHash)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      if (!hit) return null;
      return {
        number: hit.number,
        items: JSON.parse(JSON.stringify(hit.items)),
        total: hit.total,
        createdAt: hit.createdAt.toISOString(),
      };
    },
    async countByPhone(phone, since) {
      return after(since).filter((r) => r.phone === phone).length;
    },
    async countByIp(ipHash, since) {
      return after(since).filter((r) => r.ipHash === ipHash).length;
    },
    async insert(order) {
      const number = next++;
      rows.push({ ...order, number });
      return { number, createdAt: order.createdAt.toISOString() };
    },
    async anonymizeOldOrders() {
      return 0;
    },
  };
}

// 12:00 по Кишинёву (летом UTC+3)
const NOON = new Date("2026-09-19T09:00:00Z");
const minutes = (n: number) => new Date(NOON.getTime() + n * 60_000);

const kebabXxl: CartLine = {
  productSlug: "kebab-xl-xxl",
  variantId: "xxl",
  addonIds: ["sos-usturoi"],
  removedIds: [],
  qty: 2,
};
const cola: CartLine = {
  productSlug: "cola",
  variantId: null,
  addonIds: [],
  removedIds: [],
  qty: 1,
};

const order = (over: Record<string, unknown> = {}) => ({
  pointId: "soroca-centru",
  lines: [kebabXxl],
  name: "Ion",
  phone: "067 111 222",
  address: "",
  website: "",
  ...over,
});

let store: ReturnType<typeof createFakeStore>;
let ctx: SubmitContext;
beforeEach(() => {
  store = createFakeStore();
  ctx = { now: NOON, ip: null, store, log: vi.fn() };
});

describe("submitOrder — приём заказа", () => {
  it("пересчитывает цену сам: XXL 99 + sos usturoi 15 = 114 × 2 = 228", async () => {
    const r = await submitOrder(order(), ctx);
    expect(r).toMatchObject({
      ok: true,
      receipt: {
        number: 1001,
        pointId: "soroca-centru",
        pointName: "Apetit Centru",
        pointPhone: "067578757",
        city: "soroca",
        total: 228,
      },
    });
    if (!r.ok) return;
    expect(r.receipt.lines[0]).toMatchObject({
      name: { ro: "Kebab XL / XXL" },
      qty: 2,
      total: 228,
      variant: { ro: "XXL" },
      extra: [{ ro: "Sos de usturoi (în preparat)" }],
    });
  });

  it("в базу уходит одна строка: точка, город, язык, контакты, снимок, хэши", async () => {
    await submitOrder(order({ address: "Str. Independenței 1" }), {
      ...ctx,
      ip: "203.0.113.7",
    });
    expect(store.rows).toHaveLength(1);
    const row = store.rows[0];
    expect(row).toMatchObject({
      number: 1001,
      pointId: "soroca-centru",
      city: "soroca",
      lang: "ro",
      name: "Ion",
      phone: "+37367111222",
      address: "Str. Independenței 1",
      total: 228,
      createdAt: NOON,
    });
    expect(row.items).toHaveLength(1);
    expect(row.items[0]).toMatchObject({ qty: 2, unit: 114, total: 228 });
    // Хэши — 64 hex-символа, самих телефона и IP в них нет
    expect(row.dedupHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify([row.dedupHash, row.ipHash])).not.toContain("203.0");
  });

  it("без адреса и без IP — address null, ip_hash null", async () => {
    await submitOrder(order(), ctx);
    expect(store.rows[0]).toMatchObject({ address: null, ipHash: null });
  });

  it("номера сквозные с 1001", async () => {
    await submitOrder(order(), ctx);
    const r = await submitOrder(order({ phone: "067111333" }), ctx);
    expect(r.ok && r.receipt.number).toBe(1002);
  });

  it("пишет заказ в лог без полного номера телефона", async () => {
    await submitOrder(order(), ctx);
    expect(ctx.log).toHaveBeenCalledOnce();
    const logged = JSON.stringify(vi.mocked(ctx.log).mock.calls[0]);
    expect(logged).toContain("1001");
    expect(logged).not.toContain("67111222");
  });

  it("вне часов (23:00 по Кишинёву) — closed, номер не расходуется", async () => {
    const late = { ...ctx, now: new Date("2026-09-19T20:00:00Z") };
    expect(await submitOrder(order(), late)).toEqual({
      ok: false,
      code: "closed",
      hours: { open: "08:30", close: "23:00" },
    });
    const r = await submitOrder(order(), ctx);
    expect(r.ok && r.receipt.number).toBe(1001);
  });

  it("honeypot заполнен — rejected, заказ не записан", async () => {
    const r = await submitOrder(order({ website: "http://spam" }), ctx);
    expect(r).toEqual({ ok: false, code: "rejected" });
    expect(ctx.log).not.toHaveBeenCalled();
  });

  it("точка на паузе («временно не принимает») — point_paused", async () => {
    const paused: Point = {
      ...getPoint("soroca-centru")!,
      acceptingOrders: false,
    };
    const r = await submitOrder(order(), {
      ...ctx,
      getPoint: (id) => (id === paused.id ? paused : getPoint(id)),
    });
    expect(r).toEqual({ ok: false, code: "point_paused" });
  });

  it("неизвестная точка — rejected", async () => {
    expect(await submitOrder(order({ pointId: "nowhere" }), ctx)).toEqual({
      ok: false,
      code: "rejected",
    });
  });

  it("блюдо не продаётся в точке (пицца в Сороках) — unavailable с номерами позиций", async () => {
    const pizza: CartLine = { ...cola, productSlug: "pizza-margarita" };
    const r = await submitOrder(order({ lines: [cola, pizza] }), ctx);
    expect(r).toEqual({ ok: false, code: "unavailable", lines: [1] });
  });

  it("чужой размер, чужая добавка, неубираемый ингредиент — unavailable", async () => {
    const lines: CartLine[] = [
      { ...kebabXxl, variantId: "xxxl" },
      { ...cola, addonIds: ["becon"] },
      { ...kebabXxl, removedIds: ["lipie"] },
    ];
    const r = await submitOrder(order({ lines }), ctx);
    expect(r).toEqual({ ok: false, code: "unavailable", lines: [0, 1, 2] });
  });

  it("плохие поля — invalid со списком полей", async () => {
    const r = await submitOrder(order({ name: "I", phone: "123" }), ctx);
    expect(r).toEqual({
      ok: false,
      code: "invalid",
      fields: ["name", "phone"],
    });
  });

  it("мусор вместо заказа и сумма от клиента — rejected", async () => {
    expect(await submitOrder("DROP TABLE", ctx)).toEqual({
      ok: false,
      code: "rejected",
    });
    expect(await submitOrder(order({ total: 1 }), ctx)).toEqual({
      ok: false,
      code: "rejected",
    });
  });

  it("тот же заказ с того же номера за 2 минуты — тот же номер, не дубль", async () => {
    const a = await submitOrder(order(), ctx);
    const b = await submitOrder(order(), { ...ctx, now: minutes(1) });
    expect(a.ok && b.ok && b.receipt.number).toBe(1001);
    // Повтор — из базы: строка одна, время и снимок — первого заказа
    expect(store.rows).toHaveLength(1);
    expect(b.ok && b.receipt.createdAt).toBe(NOON.toISOString());
    expect(b.ok && b.receipt.total).toBe(228);
    expect(ctx.log).toHaveBeenCalledOnce();
    const c = await submitOrder(order(), { ...ctx, now: minutes(2.1) });
    expect(c.ok && c.receipt.number).toBe(1002);
  });

  it("тот же состав, другой телефон — не дубль, свой номер", async () => {
    await submitOrder(order(), ctx);
    const r = await submitOrder(order({ phone: "067111333" }), ctx);
    expect(r.ok && r.receipt.number).toBe(1002);
  });

  it("≤3 заказа с одного номера за 10 минут, потом снова можно", async () => {
    const lines = [[cola], [{ ...cola, qty: 2 }], [{ ...cola, qty: 3 }]];
    for (const l of lines) {
      expect((await submitOrder(order({ lines: l }), ctx)).ok).toBe(true);
    }
    const fourth = order({ lines: [{ ...cola, qty: 4 }] });
    expect(await submitOrder(fourth, { ...ctx, now: minutes(9) })).toEqual({
      ok: false,
      code: "rate_limited",
    });
    expect((await submitOrder(fourth, { ...ctx, now: minutes(10.1) })).ok).toBe(
      true,
    );
  });

  it("номер в другом виде (+373…) — тот же номер для лимита", async () => {
    for (const q of [1, 2, 3]) {
      await submitOrder(order({ lines: [{ ...cola, qty: q }] }), ctx);
    }
    const r = await submitOrder(
      order({ phone: "+373 67 111 222", lines: [{ ...cola, qty: 9 }] }),
      ctx,
    );
    expect(r).toEqual({ ok: false, code: "rate_limited" });
  });

  it("лимит по IP (Cloudflare): 10 заказов за 10 минут", async () => {
    const withIp = { ...ctx, ip: "203.0.113.7" };
    for (let i = 0; i < 10; i++) {
      const r = await submitOrder(order({ phone: `06711100${i}` }), withIp);
      expect(r.ok).toBe(true);
    }
    expect(await submitOrder(order({ phone: "067111099" }), withIp)).toEqual({
      ok: false,
      code: "rate_limited",
    });
    // Другой IP — можно
    const other = await submitOrder(order({ phone: "067111099" }), {
      ...withIp,
      ip: "203.0.113.8",
    });
    expect(other.ok).toBe(true);
  });

  it("база не ответила — db_error, в логе шаг и код, без данных заказа", async () => {
    store.insert = async () => {
      throw new StoreError("insert", "57P01", "terminating connection");
    };
    const r = await submitOrder(order(), ctx);
    expect(r).toEqual({ ok: false, code: "db_error" });
    expect(ctx.log).toHaveBeenCalledWith("db error", {
      step: "insert",
      code: "57P01",
      message: "terminating connection",
    });
    const logged = JSON.stringify(vi.mocked(ctx.log).mock.calls);
    expect(logged).not.toContain("67111222");
    expect(logged).not.toContain("Ion");
  });

  it("ошибка на проверке дубля (нет env, сеть) — тоже db_error, заказ не пишется", async () => {
    store.findRecent = async () => {
      throw new Error("fetch failed");
    };
    const r = await submitOrder(order(), ctx);
    expect(r).toEqual({ ok: false, code: "db_error" });
    expect(store.rows).toHaveLength(0);
    expect(ctx.log).toHaveBeenCalledWith("db error", {
      step: "unknown",
      message: "fetch failed",
    });
  });
});
