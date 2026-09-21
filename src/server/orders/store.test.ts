import { describe, expect, it, vi } from "vitest";
import type { DbClient } from "@/server/db/supabase";
import { createSupabaseOrderStore } from "./store";

// Подменённый клиент: только rpc — остальное проверяет интеграционный тест
function fakeDb(rpc: DbClient["rpc"]): DbClient {
  return { rpc } as unknown as DbClient;
}

describe("createSupabaseOrderStore — анонимизация и ошибки", () => {
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
    await expect(
      store.countByPhone("+37367111222", new Date()),
    ).rejects.toThrow("не заданы ключи");
  });
});
