// Интеграция с настоящей Supabase. Запускается только если есть .env.local
// (ключи в вывод не попадают); иначе пропускается. Свои заказы удаляет.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient, type DbClient } from "@/server/db/supabase";
import {
  createSupabaseOrderStore,
  type NewOrder,
  type OrderStore,
} from "./store";

const ENV_FILE = resolve(process.cwd(), ".env.local");
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ready = Boolean(URL && SERVICE_KEY && ANON_KEY);

const DAY = 24 * 60 * 60_000;
const run = Math.random().toString(36).slice(2, 10);
const phone = `+3736${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
const hash = (label: string) => `${label}-${run}`.padEnd(64, "0").slice(0, 64);

const line = {
  name: { ro: "Coca-Cola", ru: "Кока-кола" },
  variant: null,
  extra: [],
  cups: [],
  without: [],
  qty: 1,
  unit: 22,
  total: 22,
};

function newOrder(over: Partial<NewOrder> = {}): NewOrder {
  return {
    pointId: "briceni",
    city: "briceni",
    lang: "ro",
    name: "Test Integrare",
    phone,
    address: null,
    items: [line],
    total: 22,
    ipHash: hash("ip"),
    dedupHash: hash("dedup"),
    createdAt: new Date(),
    ...over,
  };
}

/**
 * Эти тесты ходят в настоящую базу по сети. Пять секунд (умолчание vitest)
 * при полном параллельном прогоне иногда не хватает — тест падал по
 * таймауту, хотя код исправен. Тридцати хватает с запасом, и это всё ещё
 * не «ждать вечно»: настоящий обрыв связи тест поймает.
 */
const NET = { timeout: 30_000 };

describe.skipIf(!ready)("orders в настоящей Supabase (.env.local)", NET, () => {
  // Клиент — только когда тесты действительно идут (при пропуске env нет)
  let db: DbClient;
  let store: OrderStore;
  beforeAll(() => {
    db = createServiceClient(URL ?? "", SERVICE_KEY ?? "");
    store = createSupabaseOrderStore(() => db);
  });
  const created: number[] = [];
  const place = async (order: NewOrder) => {
    const r = await store.place(order);
    if (r.outcome === "created") created.push(r.order.number);
    return r;
  };

  afterAll(async () => {
    if (created.length === 0) return;
    const { error } = await db.from("orders").delete().in("number", created);
    if (error) throw new Error(`cleanup: ${error.code} ${error.message}`);
  });

  it("таблицы orders и settings существуют и доступны service-role", async () => {
    for (const table of ["orders", "settings"] as const) {
      const { error } = await db
        .from(table)
        .select("*", { count: "exact", head: true });
      expect(error, table).toBeNull();
    }
  });

  it("anon-ключ: отказ на чтение, запись и функции (RLS, без прав)", async () => {
    const anon = createClient(URL ?? "", ANON_KEY ?? "", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const read = await anon.from("orders").select("id").limit(1);
    expect(
      read.error?.code ?? (read.data?.length === 0 ? "empty" : "data"),
    ).toMatch(/^(42501|empty)$/);
    const write = await anon.from("orders").insert({
      point_id: "x",
      city: "x",
      lang: "ro",
      name: "x",
      phone: "x",
      items: [],
      total: 0,
      dedup_hash: "x",
    });
    expect(write.error).not.toBeNull();
    expect((await anon.rpc("anonymize_old_orders")).error).not.toBeNull();
    const placed = await anon.rpc("place_order", {
      p_point_id: "x",
      p_city: "x",
      p_lang: "ro",
      p_name: "x",
      p_phone: "x",
      p_address: null,
      p_items: [],
      p_total: 0,
      p_ip_hash: null,
      p_dedup_hash: "x",
      p_now: new Date().toISOString(),
      p_dedup_seconds: 1,
      p_phone_limit: 1,
      p_phone_window_seconds: 1,
      p_ip_limit: 1,
      p_ip_window_seconds: 1,
    });
    expect(placed.error).not.toBeNull();
    const settings = await anon.from("settings").select("key").limit(1);
    expect(
      settings.error?.code ?? (settings.data?.length === 0 ? "empty" : "data"),
    ).toMatch(/^(42501|empty)$/);
  });

  it("place_order: номер из sequence ≥ 1001 и растёт; дубль → тот же заказ; лимит по телефону", async () => {
    const now = new Date();
    const a = await place(
      newOrder({ createdAt: new Date(now.getTime() - 60_000) }),
    );
    const b = await place(
      newOrder({ dedupHash: hash("second"), createdAt: now }),
    );
    expect(a.outcome).toBe("created");
    expect(b.outcome).toBe("created");
    if (a.outcome !== "created" || b.outcome !== "created") return;
    expect(a.order.number).toBeGreaterThanOrEqual(1001);
    expect(b.order.number).toBeGreaterThan(a.order.number);
    expect(new Date(b.order.createdAt).getTime()).toBe(now.getTime());
    expect(a.order.id).toMatch(/^[0-9a-f-]{36}$/);

    // Дубль: тот же dedup_hash в окне 2 минуты → записанный заказ, строки не прибавилось
    const dup = await place(
      newOrder({ createdAt: new Date(now.getTime() + 30_000) }),
    );
    expect(dup).toMatchObject({
      outcome: "duplicate",
      order: { number: a.order.number, total: 22, items: [line] },
    });
    // Спустя 3 минуты тот же состав — уже не дубль, но это 3-й заказ с номера
    const third = await place(
      newOrder({ createdAt: new Date(now.getTime() + 3 * 60_000) }),
    );
    expect(third.outcome).toBe("created");
    // 4-й за 10 минут — лимит
    const fourth = await place(
      newOrder({
        dedupHash: hash("fourth"),
        createdAt: new Date(now.getTime() + 4 * 60_000),
      }),
    );
    expect(fourth).toEqual({ outcome: "limited", by: "phone" });
    // Через 11 минут после первого — снова можно
    const later = await place(
      newOrder({
        dedupHash: hash("later"),
        createdAt: new Date(now.getTime() + 11 * 60_000),
      }),
    );
    expect(later.outcome).toBe("created");
  });

  it("атомарный лимит: залп из 6 одновременных заказов с одного номера → ровно 3 приняты", async () => {
    const burstPhone = `+3736${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
    const now = new Date();
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        place(
          newOrder({
            phone: burstPhone,
            dedupHash: hash(`burst${i}`),
            ipHash: null,
            createdAt: now,
          }),
        ),
      ),
    );
    const outcomes = results.map((r) => r.outcome).sort();
    expect(outcomes).toEqual([
      "created",
      "created",
      "created",
      "limited",
      "limited",
      "limited",
    ]);
  });

  it("лимит по IP: 10 заказов с разных номеров, 11-й — limited by ip", async () => {
    const ip = hash("burst-ip");
    const now = new Date();
    for (let i = 0; i < 10; i++) {
      const r = await place(
        newOrder({
          phone: `+37360${String(100000 + i)}`,
          dedupHash: hash(`ip${i}`),
          ipHash: ip,
          createdAt: now,
        }),
      );
      expect(r.outcome, `order ${i}`).toBe("created");
    }
    const eleventh = await place(
      newOrder({
        phone: "+37360100099",
        dedupHash: hash("ip99"),
        ipHash: ip,
        createdAt: now,
      }),
    );
    expect(eleventh).toEqual({ outcome: "limited", by: "ip" });
  });

  // Миграция 0006: признак ставится внутри place_order(), той же вставкой.
  // Проверяем на настоящей базе — иначе «герметичность» остаётся словами.
  //
  // Миграции в этом проекте применяет хозяин вручную (Supabase → SQL Editor),
  // поэтому тест сначала спрашивает базу, есть ли уже параметр p_is_test:
  // нет — пропускается с криком в лог, а не красит прогон в красный из-за
  // ненажатой кнопки. Обычные заказы от этого не зависят: они зовут функцию
  // без этого параметра.
  it("place(isTest): строка сразу с is_test = true; обычный заказ — false", async (ctx) => {
    // Проба ничего не записывает: с p_phone_limit = 0 функция сразу
    // отвечает limited, до вставки дело не доходит
    const probe = await db.rpc("place_order", {
      p_point_id: "briceni",
      p_city: "briceni",
      p_lang: "ro",
      p_name: "probe",
      p_phone: "+37360300000",
      p_address: null,
      p_items: [],
      p_total: 0,
      p_ip_hash: null,
      p_dedup_hash: hash("probe"),
      p_now: new Date().toISOString(),
      p_dedup_seconds: 1,
      p_phone_limit: 0,
      p_phone_window_seconds: 1,
      p_ip_limit: 0,
      p_ip_window_seconds: 1,
      p_is_test: true,
    });
    if (probe.error) {
      console.error(
        "[orders] миграция 0006 не применена: у place_order() нет параметра" +
          " p_is_test — Supabase → SQL Editor →" +
          " supabase/migrations/0006_place_order_is_test.sql → Run",
      );
      ctx.skip();
      return;
    }

    const test = await place(
      newOrder({
        phone: "+37360300001",
        dedupHash: hash("is-test"),
        isTest: true,
      }),
    );
    const live = await place(
      newOrder({ phone: "+37360300002", dedupHash: hash("is-live") }),
    );
    expect(test.outcome).toBe("created");
    expect(live.outcome).toBe("created");
    if (test.outcome !== "created" || live.outcome !== "created") return;

    const rows = await db
      .from("orders")
      .select("number, is_test")
      .in("number", [test.order.number, live.order.number]);
    expect(rows.error).toBeNull();
    const byNumber = Object.fromEntries(
      (rows.data ?? []).map((r) => [r.number, r.is_test]),
    );
    expect(byNumber[test.order.number]).toBe(true);
    expect(byNumber[live.order.number]).toBe(false);
  });

  it("anonymize_old_orders(): заказ старше года — без имени, телефона, адреса; свежий цел", async () => {
    const old = await place(
      newOrder({
        phone: "+37360200001",
        address: "Str. Veche 1",
        dedupHash: hash("old"),
        createdAt: new Date(Date.now() - 400 * DAY),
      }),
    );
    const fresh = await place(
      newOrder({
        phone: "+37360200002",
        address: "Str. Nouă 2",
        dedupHash: hash("fresh"),
      }),
    );
    expect(old.outcome).toBe("created");
    expect(fresh.outcome).toBe("created");
    if (old.outcome !== "created" || fresh.outcome !== "created") return;

    expect(await store.anonymizeOldOrders()).toBeGreaterThanOrEqual(1);

    const rows = await db
      .from("orders")
      .select("number, name, phone, address, items, total")
      .in("number", [old.order.number, fresh.order.number]);
    expect(rows.error).toBeNull();
    const byNumber = Object.fromEntries(
      (rows.data ?? []).map((r) => [r.number, r]),
    );
    expect(byNumber[old.order.number]).toMatchObject({
      name: "",
      phone: "",
      address: null,
      total: 22,
    });
    expect(byNumber[old.order.number]?.items).toEqual([line]);
    expect(byNumber[fresh.order.number]).toMatchObject({
      name: "Test Integrare",
      phone: "+37360200002",
      address: "Str. Nouă 2",
    });
  });
});
