// Хранилище заказов (SPEC §9.3, §9.4) — таблица orders в Supabase.
// Приём заказа — одна функция базы place_order(): дубль, лимиты и INSERT в
// одной транзакции с блокировкой по телефону и IP (залп запросов лимит не
// пробьёт). Здесь только вызовы базы; решения по outcome — в submit.ts.
// В unit-тестах вместо этого — fake store.
import type { ReceiptLine } from "@/lib/order/receipt";
import type { DbClient } from "@/server/db/supabase";
import type { Json } from "@/server/db/types";
import { z } from "@/lib/zod";

export const PHONE_LIMIT = { max: 3, windowMs: 10 * 60_000 };
export const IP_LIMIT = { max: 10, windowMs: 10 * 60_000 };
export const DEDUP_MS = 2 * 60_000;

export interface NewOrder {
  pointId: string;
  city: string;
  /** Язык формы (ro/ru) */
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
  /** Заказ оставлен прогоном тестов — Telegram и напоминания его не увидят */
  isTest?: boolean;
}

export interface PlacedOrder {
  id: string;
  number: number;
  /** Снимок позиций как лежит в базе — проверяется схемой при чтении */
  items: unknown;
  total: number;
  createdAt: string;
}

export type PlaceOutcome =
  | { outcome: "created"; order: PlacedOrder }
  /** Тот же телефон и состав за 2 минуты — записанный ранее заказ */
  | { outcome: "duplicate"; order: PlacedOrder }
  | { outcome: "limited"; by: "phone" | "ip" };

export interface OrderStore {
  /** Дубль → лимиты → INSERT одной транзакцией; номер выдаёт sequence базы */
  place(order: NewOrder): Promise<PlaceOutcome>;
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

export function fail(
  step: string,
  error: { code?: string; message: string },
): never {
  throw new StoreError(step, error.code ?? "", error.message);
}

const PlacedSchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive(),
  items: z.unknown(),
  total: z.number().int().nonnegative(),
  created_at: z.string(),
});

const OutcomeSchema = z.discriminatedUnion("outcome", [
  PlacedSchema.extend({ outcome: z.literal("created") }),
  PlacedSchema.extend({ outcome: z.literal("duplicate") }),
  z.object({ outcome: z.literal("limited"), by: z.enum(["phone", "ip"]) }),
]);

/**
 * Клиент берётся функцией, а не значением: если env не задан, ошибка
 * всплывёт внутри запроса — submit.ts поймает её как ошибку базы.
 */
export function createSupabaseOrderStore(getDb: () => DbClient): OrderStore {
  return {
    async place(order) {
      const { data, error } = await getDb().rpc("place_order", {
        p_point_id: order.pointId,
        p_city: order.city,
        p_lang: order.lang,
        p_name: order.name,
        p_phone: order.phone,
        p_address: order.address,
        // ReceiptLine — обычный JSON (строки, числа, null, массивы)
        p_items: order.items as unknown as Json,
        p_total: order.total,
        p_ip_hash: order.ipHash,
        p_dedup_hash: order.dedupHash,
        p_now: order.createdAt.toISOString(),
        p_dedup_seconds: DEDUP_MS / 1000,
        p_phone_limit: PHONE_LIMIT.max,
        p_phone_window_seconds: PHONE_LIMIT.windowMs / 1000,
        p_ip_limit: IP_LIMIT.max,
        p_ip_window_seconds: IP_LIMIT.windowMs / 1000,
      });
      if (error) fail("place", error);
      const parsed = OutcomeSchema.safeParse(data);
      if (!parsed.success) {
        fail("place", {
          code: "bad_result",
          message: "place_order: unexpected result",
        });
      }
      const r = parsed.data;
      if (r.outcome === "limited") return { outcome: "limited", by: r.by };
      // Заказ из прогона тестов — пометить сразу, отдельным UPDATE:
      // place_order() и выдачу номеров не трогаем. Напоминания смотрят
      // только на заказы старше двух минут, так что этот зазор им не виден.
      // Не получилось пометить по другой причине — приём считается
      // неудачным (submit.ts вернёт db_error и никуда ничего не отправит):
      // лучше упавший тест, чем строка, неотличимая от настоящего заказа.
      if (order.isTest && r.outcome === "created") {
        const { error: markError } = await getDb()
          .from("orders")
          .update({ is_test: true })
          .eq("id", r.id);
        // 42703 / PGRST204 — колонки нет: миграция 0005 в этой базе не
        // применена (PostgREST на UPDATE отвечает про кеш схемы).
        // Заказ всё равно не уйдёт в Telegram (признак известен этому
        // запросу), но строка останется неотличимой от настоящей — об этом
        // надо кричать в лог, а не валить прогон.
        if (markError?.code === "42703" || markError?.code === "PGRST204") {
          console.error(
            "[orders] миграция 0005 не применена: в orders нет колонки is_test —" +
              " заказ из теста записан как обычный",
          );
        } else if (markError) {
          fail("mark_test", markError);
        }
      }
      return {
        outcome: r.outcome,
        order: {
          id: r.id,
          number: r.number,
          items: r.items,
          total: r.total,
          createdAt: r.created_at,
        },
      };
    },

    async anonymizeOldOrders() {
      const { data, error } = await getDb().rpc("anonymize_old_orders");
      if (error) fail("anonymize", error);
      return data ?? 0;
    },
  };
}
