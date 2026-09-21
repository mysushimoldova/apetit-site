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

describe.skipIf(!ready)("orders в настоящей Supabase (.env.local)", () => {
  // Клиент — только когда тесты действительно идут (при пропуске env нет)
  let db: DbClient;
  let store: OrderStore;
  beforeAll(() => {
    db = createServiceClient(URL ?? "", SERVICE_KEY ?? "");
    store = createSupabaseOrderStore(() => db);
  });
  const created: number[] = [];
  const insert = async (order: NewOrder) => {
    const r = await store.insert(order);
    created.push(r.number);
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

  it("anon-ключ: отказ на чтение, запись и функцию (RLS, без прав)", async () => {
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
    const fn = await anon.rpc("anonymize_old_orders");
    expect(fn.error).not.toBeNull();
    const settings = await anon.from("settings").select("key").limit(1);
    expect(
      settings.error?.code ?? (settings.data?.length === 0 ? "empty" : "data"),
    ).toMatch(/^(42501|empty)$/);
  });

  it("insert: номер из sequence ≥ 1001 и растёт; дубль и лимиты видят строки", async () => {
    const now = new Date();
    const a = await insert(
      newOrder({ createdAt: new Date(now.getTime() - 60_000) }),
    );
    const b = await insert(newOrder({ createdAt: now }));
    expect(a.number).toBeGreaterThanOrEqual(1001);
    expect(b.number).toBeGreaterThan(a.number);
    expect(new Date(b.createdAt).getTime()).toBe(now.getTime());

    // Дубль: самый свежий с тем же dedup_hash за 2 минуты
    const recent = await store.findRecent(
      hash("dedup"),
      new Date(now.getTime() - 2 * 60_000),
    );
    expect(recent).toMatchObject({ number: b.number, total: 22 });
    expect(recent?.items).toEqual([line]);
    // Окно позже обоих — пусто
    expect(
      await store.findRecent(hash("dedup"), new Date(now.getTime() + 1000)),
    ).toBeNull();

    // Лимиты: по телефону и по IP — обе строки; чужой телефон — 0
    const since = new Date(now.getTime() - 10 * 60_000);
    expect(await store.countByPhone(phone, since)).toBe(2);
    expect(await store.countByIp(hash("ip"), since)).toBe(2);
    expect(await store.countByPhone("+37360000000", since)).toBe(0);
  });

  it("anonymize_old_orders(): заказ старше года — без имени, телефона, адреса; свежий цел", async () => {
    const old = await insert(
      newOrder({
        address: "Str. Veche 1",
        dedupHash: hash("old"),
        createdAt: new Date(Date.now() - 400 * DAY),
      }),
    );
    const fresh = await insert(
      newOrder({ address: "Str. Nouă 2", dedupHash: hash("fresh") }),
    );

    expect(await store.anonymizeOldOrders()).toBeGreaterThanOrEqual(1);

    const rows = await db
      .from("orders")
      .select("number, name, phone, address, items, total")
      .in("number", [old.number, fresh.number]);
    expect(rows.error).toBeNull();
    const byNumber = Object.fromEntries(
      (rows.data ?? []).map((r) => [r.number, r]),
    );
    expect(byNumber[old.number]).toMatchObject({
      name: "",
      phone: "",
      address: null,
      total: 22,
    });
    expect(byNumber[old.number]?.items).toEqual([line]);
    expect(byNumber[fresh.number]).toMatchObject({
      name: "Test Integrare",
      phone,
      address: "Str. Nouă 2",
    });
  });
});
