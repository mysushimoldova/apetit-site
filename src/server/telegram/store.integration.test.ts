// Интеграция Telegram-хранилища с настоящей Supabase (миграция 0002).
// Только при .env.local; свои строки удаляет. Сообщений в Telegram не шлёт.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient, type DbClient } from "@/server/db/supabase";
import { createSupabaseTelegramStore, type TelegramStore } from "./store";

const ENV_FILE = resolve(process.cwd(), ".env.local");
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ready = Boolean(URL && SERVICE_KEY);

const TEST_POINT_ID = "test-point-integrare";
const TEST_CHAT = -900000000001;
const TEST_OWNER = -900000000002;

/** Сеть медленнее пяти секунд по умолчанию — см. orders/store.integration. */
const NET = { timeout: 30_000 };

describe.skipIf(!ready)("telegram store в настоящей Supabase", NET, () => {
  let db: DbClient;
  let store: TelegramStore;
  const orderNumbers: number[] = [];
  beforeAll(() => {
    db = createServiceClient(URL ?? "", SERVICE_KEY ?? "");
    store = createSupabaseTelegramStore(() => db);
  });

  afterAll(async () => {
    await db.from("telegram_chats").delete().eq("point_id", TEST_POINT_ID);
    await db.from("owner_chats").delete().eq("chat_id", TEST_OWNER);
    if (orderNumbers.length) {
      await db.from("orders").delete().in("number", orderNumbers);
    }
  });

  it("коды привязки созданы: 5 точек + владелец, 8 знаков без похожих символов", async () => {
    const { data, error } = await db
      .from("telegram_codes")
      .select("code, kind, point_id, label");
    expect(error).toBeNull();
    const rows = data ?? [];
    const points = rows
      .filter((r) => r.kind === "point")
      .map((r) => r.point_id);
    expect(points.sort()).toEqual(
      ["briceni", "otaci", "sculeni", "soroca-centru", "soroca-noua"].sort(),
    );
    expect(rows.filter((r) => r.kind === "owner")).toHaveLength(1);
    for (const r of rows) {
      expect(r.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    }
    const found = await store.findCode(rows[0].code);
    expect(found).toMatchObject({ kind: rows[0].kind, label: rows[0].label });
    expect(await store.findCode("NOPE0000")).toBeNull();
  });

  it("linkPoint / linkOwner — upsert, pointChat и ownerChats их видят", async () => {
    expect(await store.pointChat(TEST_POINT_ID)).toBeNull();
    await store.linkPoint(TEST_POINT_ID, TEST_CHAT, "Test");
    await store.linkPoint(TEST_POINT_ID, TEST_CHAT, "Test 2"); // повтор — обновление
    expect(await store.pointChat(TEST_POINT_ID)).toEqual({
      chatId: TEST_CHAT,
      title: "Test 2",
    });
    await store.linkOwner(TEST_OWNER, "Test owner");
    await store.linkOwner(TEST_OWNER, "Test owner");
    expect(await store.ownerChats()).toContain(TEST_OWNER);
  });

  it("orderById, setTelegramResult, pendingAlerts, claimStage, acceptOrder (второй раз — null)", async () => {
    const created = new Date(Date.now() - 5 * 60_000); // 5 минут назад
    const ins = await db
      .from("orders")
      .insert({
        point_id: TEST_POINT_ID,
        city: "briceni",
        lang: "ro",
        name: "Test Integrare",
        phone: "+37360300001",
        items: [],
        total: 0,
        dedup_hash: `tg-${Math.random()}`,
        created_at: created.toISOString(),
      })
      .select("id, number")
      .single();
    expect(ins.error).toBeNull();
    const id = ins.data!.id;
    orderNumbers.push(ins.data!.number);

    expect(await store.orderById(id)).toMatchObject({
      id,
      status: "new",
      telegram_message_id: null,
    });
    await store.setTelegramResult(id, { messageId: 12345, error: null });
    expect((await store.orderById(id))?.telegram_message_id).toBe(12345);

    // Кандидаты лестницы: заказу 5 минут → в выборке (старше 2 мин, владельцам < 3)
    const now = new Date();
    const pending = await store.pendingAlerts(now, 2, 15, 3, TEST_POINT_ID);
    expect(pending).toEqual([
      {
        id,
        number: ins.data!.number,
        pointId: TEST_POINT_ID,
        createdAt: expect.any(String),
        remindersSent: 0,
        ownerAlertsSent: 0,
        // message_id записан строкой выше — карточка дошла
        delivered: true,
      },
    ]);
    expect(await store.pendingAlerts(now, 10, 15, 3, TEST_POINT_ID)).toEqual(
      [],
    );

    // Условный UPDATE: ступень забирается один раз; чужое expected — нет
    expect(await store.claimStage(id, "reminder", 0, now)).toBe(true);
    expect(await store.claimStage(id, "reminder", 0, now)).toBe(false);
    expect(await store.claimStage(id, "reminder", 1, now)).toBe(true);
    expect(await store.claimStage(id, "owner", 0, now)).toBe(true);
    const counters = await store.pendingAlerts(now, 2, 15, 3, TEST_POINT_ID);
    expect(counters[0]).toMatchObject({
      remindersSent: 2,
      ownerAlertsSent: 1,
    });

    // Обе дорожки пройдены до конца → заказ больше не кандидат
    expect(await store.pendingAlerts(now, 2, 2, 1, TEST_POINT_ID)).toEqual([]);

    const at = new Date();
    const accepted = await store.acceptOrder(id, at);
    expect(accepted).toMatchObject({ id, status: "accepted" });
    expect(await store.acceptOrder(id, new Date())).toBeNull();
    // Принятый — из кандидатов выпадает, ступень забрать нельзя
    expect(await store.pendingAlerts(now, 2, 15, 3, TEST_POINT_ID)).toEqual([]);
    expect(await store.claimStage(id, "owner", 1, now)).toBe(false);
    expect(
      await store.orderById("00000000-0000-4000-8000-000000000000"),
    ).toBeNull();
  });
});
