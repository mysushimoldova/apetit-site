import { describe, expect, it, vi } from "vitest";
import type { DbClient } from "@/server/db/supabase";
import { createSupabaseOrderStore } from "./store";

// Подменённый клиент: только rpc — остальное проверяет интеграционный тест
function fakeDb(rpc: DbClient["rpc"]): DbClient {
  return { rpc } as unknown as DbClient;
}

describe("createSupabaseOrderStore — анонимизация, place_order и ошибки", () => {
  it("place() зовёт place_order с окнами в секундах и разбирает outcome", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        outcome: "created",
        id: "00000000-0000-4000-8000-000000000001",
        number: 1001,
        items: [],
        total: 22,
        created_at: "2026-09-19T09:00:00+00:00",
      },
      error: null,
    }));
    const store = createSupabaseOrderStore(() =>
      fakeDb(rpc as unknown as DbClient["rpc"]),
    );
    const r = await store.place({
      pointId: "briceni",
      city: "briceni",
      lang: "ro",
      name: "Ion",
      phone: "+37367111222",
      address: null,
      items: [],
      total: 22,
      ipHash: null,
      dedupHash: "d",
      createdAt: new Date("2026-09-19T09:00:00Z"),
    });
    expect(r).toEqual({
      outcome: "created",
      order: {
        id: "00000000-0000-4000-8000-000000000001",
        number: 1001,
        items: [],
        total: 22,
        createdAt: "2026-09-19T09:00:00+00:00",
      },
    });
    expect(rpc).toHaveBeenCalledWith(
      "place_order",
      expect.objectContaining({
        p_phone: "+37367111222",
        p_now: "2026-09-19T09:00:00.000Z",
        p_dedup_seconds: 120,
        p_phone_limit: 3,
        p_phone_window_seconds: 600,
        p_ip_limit: 10,
        p_ip_window_seconds: 600,
      }),
    );
  });

  it("place(): limited и неожиданный ответ базы", async () => {
    const rpc = vi.fn(async () => ({
      data: { outcome: "limited", by: "phone" },
      error: null,
    }));
    const store = createSupabaseOrderStore(() =>
      fakeDb(rpc as unknown as DbClient["rpc"]),
    );
    const order = {
      pointId: "briceni",
      city: "briceni",
      lang: "ro",
      name: "Ion",
      phone: "+37367111222",
      address: null,
      items: [],
      total: 22,
      ipHash: null,
      dedupHash: "d",
      createdAt: new Date(),
    };
    expect(await store.place(order)).toEqual({
      outcome: "limited",
      by: "phone",
    });
    rpc.mockResolvedValueOnce({
      data: { outcome: "weird", by: "" },
      error: null,
    });
    await expect(store.place(order)).rejects.toMatchObject({
      name: "StoreError",
      step: "place",
      code: "bad_result",
    });
  });

  it("anonymizeOldOrders() вызывает функцию базы и возвращает число строк", async () => {
    const rpc = vi.fn(async () => ({ data: 3, error: null }));
    const store = createSupabaseOrderStore(() =>
      fakeDb(rpc as unknown as DbClient["rpc"]),
    );
    expect(await store.anonymizeOldOrders()).toBe(3);
    expect(rpc).toHaveBeenCalledWith("anonymize_old_orders");
  });

  it("ошибка базы → StoreError с шагом и кодом", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: "42501", message: "permission denied" },
    }));
    const store = createSupabaseOrderStore(() =>
      fakeDb(rpc as unknown as DbClient["rpc"]),
    );
    await expect(store.anonymizeOldOrders()).rejects.toMatchObject({
      name: "StoreError",
      step: "anonymize",
      code: "42501",
      message: "permission denied",
    });
  });

  it("клиент не собрался (нет env) — ошибка всплывает из запроса, не при создании", async () => {
    const store = createSupabaseOrderStore(() => {
      throw new Error("Supabase: не заданы ключи");
    });
    await expect(store.anonymizeOldOrders()).rejects.toThrow("не заданы ключи");
  });
});
