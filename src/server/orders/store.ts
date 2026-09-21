// Хранилище заказов (SPEC §9.3, §9.4) — таблица orders в Supabase.
// Здесь только запросы к базе; решения (лимит превышен, вернуть прежний
// номер) принимает submit.ts. В unit-тестах вместо этого — fake store.
import type { ReceiptLine } from "@/lib/order/receipt";
import type { DbClient } from "@/server/db/supabase";
import type { Json } from "@/server/db/types";

export const PHONE_LIMIT = { max: 3, windowMs: 10 * 60_000 };
export const IP_LIMIT = { max: 10, windowMs: 10 * 60_000 };
export const DEDUP_MS = 2 * 60_000;

export interface NewOrder {
  pointId: string;
  city: string;
  lang: string;
  name: string;
  /** Нормализованный: +373XXXXXXXX */
  phone: string;
  address: string | null;
  items: ReceiptLine[];
  total: number;
  ipHash: string | null;
  dedupHash: string;
  createdAt: Date;
}

export interface StoredOrder {
  number: number;
  /** Снимок позиций как лежит в базе — проверяется схемой при чтении */
  items: unknown;
  total: number;
  createdAt: string;
}

export interface OrderStore {
  /** Самый свежий заказ с тем же dedup_hash не старше since (дубль за 2 мин) */
  findRecent(dedupHash: string, since: Date): Promise<StoredOrder | null>;
  /** Сколько заказов с номера / с IP не старше since (лимиты) */
  countByPhone(phone: string, since: Date): Promise<number>;
  countByIp(ipHash: string, since: Date): Promise<number>;
  /** Один INSERT; номер выдаёт sequence базы */
  insert(order: NewOrder): Promise<{ number: number; createdAt: string }>;
  /** anonymize_old_orders() — сколько заказов старше года обезличено */
  anonymizeOldOrders(): Promise<number>;
}

/** Ошибка базы: шаг и код — в лог, персональных данных здесь нет. */
export class StoreError extends Error {
  constructor(
    readonly step: string,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "StoreError";
  }
}

function fail(step: string, error: { code?: string; message: string }): never {
  throw new StoreError(step, error.code ?? "", error.message);
}

/**
 * Клиент берётся функцией, а не значением: если env не задан, ошибка
 * всплывёт внутри запроса — submit.ts поймает её как ошибку базы.
 */
export function createSupabaseOrderStore(getDb: () => DbClient): OrderStore {
  return {
    async findRecent(dedupHash, since) {
      const { data, error } = await getDb()
        .from("orders")
        .select("number, items, total, created_at")
        .eq("dedup_hash", dedupHash)
        .gt("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) fail("findRecent", error);
      if (!data) return null;
      return {
        number: data.number,
        items: data.items,
        total: data.total,
        createdAt: data.created_at,
      };
    },

    async countByPhone(phone, since) {
      const { count, error } = await getDb()
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("phone", phone)
        .gt("created_at", since.toISOString());
      if (error) fail("countByPhone", error);
      return count ?? 0;
    },

    async countByIp(ipHash, since) {
      const { count, error } = await getDb()
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gt("created_at", since.toISOString());
      if (error) fail("countByIp", error);
      return count ?? 0;
    },

    async insert(order) {
      const { data, error } = await getDb()
        .from("orders")
        .insert({
          point_id: order.pointId,
          city: order.city,
          lang: order.lang,
          name: order.name,
          phone: order.phone,
          address: order.address,
          // ReceiptLine — обычный JSON (строки, числа, null, массивы)
          items: order.items as unknown as Json,
          total: order.total,
          ip_hash: order.ipHash,
          dedup_hash: order.dedupHash,
          created_at: order.createdAt.toISOString(),
        })
        .select("number, created_at")
        .single();
      if (error) fail("insert", error);
      return { number: data.number, createdAt: data.created_at };
    },

    async anonymizeOldOrders() {
      const { data, error } = await getDb().rpc("anonymize_old_orders");
      if (error) fail("anonymize", error);
      return data ?? 0;
    },
  };
}
