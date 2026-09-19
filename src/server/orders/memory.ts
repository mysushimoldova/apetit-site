// Счётчик номеров, лимиты и защита от дублей (SPEC §9.3, §9.4) — пока в
// памяти процесса. Ограничения этого решения: при перезапуске сервера всё
// обнуляется (номера снова с 1001), а на Cloudflare Workers у каждого
// экземпляра своя память — лимиты и номера не общие.
// TODO: перенести в Supabase (сквозной номер — sequence, лимиты и дубли —
// запросы к таблице orders).
import type { OrderReceipt } from "@/lib/order/receipt";

/** Номера заказов — сквозные, с 1001 (SPEC §9.3). */
export const FIRST_ORDER_NUMBER = 1001;

export const PHONE_LIMIT = { max: 3, windowMs: 10 * 60_000 };
export const IP_LIMIT = { max: 10, windowMs: 10 * 60_000 };
export const DEDUP_MS = 2 * 60_000;

/** Потолок ключей в каждой таблице: поток мусорных номеров не съест память. */
const MAX_KEYS = 10_000;

/** Скользящее окно: сколько событий по ключу за последние windowMs. */
class SlidingWindow {
  private hits = new Map<string, number[]>();
  constructor(private readonly limit: { max: number; windowMs: number }) {}

  private recent(key: string, now: number): number[] {
    const since = now - this.limit.windowMs;
    return (this.hits.get(key) ?? []).filter((t) => t > since);
  }

  allows(key: string, now: number): boolean {
    return this.recent(key, now).length < this.limit.max;
  }

  record(key: string, now: number): void {
    const list = this.recent(key, now);
    list.push(now);
    this.hits.delete(key); // в конец — самые свежие
    this.hits.set(key, list);
    trim(this.hits);
  }
}

function trim<V>(map: Map<string, V>): void {
  // Map помнит порядок вставки — удаляем самые старые ключи
  while (map.size > MAX_KEYS) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

interface Recent {
  fingerprint: string;
  receipt: OrderReceipt;
  at: number;
}

export interface OrderMemory {
  /** Тот же заказ с того же номера за 2 минуты — вернуть прежний. */
  findDuplicate(
    phone: string,
    fingerprint: string,
    now: number,
  ): OrderReceipt | null;
  /** Можно ли принять ещё один заказ (номер ≤3 / 10 мин, IP ≤10 / 10 мин). */
  allows(phone: string, ip: string | null, now: number): boolean;
  /** Выдать номер и запомнить заказ для лимитов и дублей. */
  commit(
    phone: string,
    ip: string | null,
    fingerprint: string,
    now: number,
    build: (orderNumber: number) => OrderReceipt,
  ): OrderReceipt;
}

export function createOrderMemory(): OrderMemory {
  let nextNumber = FIRST_ORDER_NUMBER;
  const byPhone = new SlidingWindow(PHONE_LIMIT);
  const byIp = new SlidingWindow(IP_LIMIT);
  const recent = new Map<string, Recent>();

  return {
    findDuplicate(phone, fingerprint, now) {
      const last = recent.get(phone);
      if (!last || now - last.at > DEDUP_MS) return null;
      return last.fingerprint === fingerprint ? last.receipt : null;
    },
    allows(phone, ip, now) {
      if (!byPhone.allows(phone, now)) return false;
      return ip === null || byIp.allows(ip, now);
    },
    commit(phone, ip, fingerprint, now, build) {
      const receipt = build(nextNumber++);
      byPhone.record(phone, now);
      if (ip !== null) byIp.record(ip, now);
      recent.delete(phone);
      recent.set(phone, { fingerprint, receipt, at: now });
      trim(recent);
      return receipt;
    },
  };
}
