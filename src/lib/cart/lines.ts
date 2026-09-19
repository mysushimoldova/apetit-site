// Позиции корзины (SPEC §3 шаг 4, §9.3). Позиция хранит только id — блюдо,
// размер, добавки, убранные ингредиенты — и количество. Никаких цен и названий:
// цену всегда пересчитывает сервер по актуальным данным точки.
// Одинаковые конфигурации складываются в одну позицию.
import { z } from "@/lib/zod";
import { isCitySlug, type CitySlug } from "@/data/points";

/** Потолок штук в одной позиции — защита от «99999» из localStorage. */
export const MAX_QTY = 99;

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const CartLineSchema = z.object({
  productSlug: id,
  variantId: id.nullable(),
  addonIds: z.array(id).max(30),
  removedIds: z.array(id).max(30),
  qty: z.number().int().min(1).max(MAX_QTY),
});
export type CartLine = z.infer<typeof CartLineSchema>;

/** Конфигурация блюда без количества — то, что делает позицию уникальной. */
export type LineConfig = Omit<CartLine, "qty">;

/** Без повторов, по алфавиту: «becon, sos» и «sos, becon» — одно и то же. */
function normalizeIds(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort();
}

export function normalizeConfig(config: LineConfig): LineConfig {
  return {
    productSlug: config.productSlug,
    variantId: config.variantId,
    addonIds: normalizeIds(config.addonIds),
    removedIds: normalizeIds(config.removedIds),
  };
}

/** Ключ позиции: одинаковый ключ = одинаковая конфигурация. */
export function lineKey(config: LineConfig): string {
  const c = normalizeConfig(config);
  return [
    c.productSlug,
    c.variantId ?? "",
    c.addonIds.join(","),
    c.removedIds.join(","),
  ].join("|");
}

const clampQty = (qty: number) => Math.min(Math.max(qty, 0), MAX_QTY);

/** Добавить qty штук конфигурации; такая уже есть — количество складывается. */
export function addLine(
  lines: readonly CartLine[],
  config: LineConfig,
  qty = 1,
): CartLine[] {
  if (!(qty >= 1)) return [...lines];
  const key = lineKey(config);
  const index = lines.findIndex((l) => lineKey(l) === key);
  if (index === -1) {
    return [...lines, { ...normalizeConfig(config), qty: clampQty(qty) }];
  }
  return lines.map((l, i) =>
    i === index ? { ...l, qty: clampQty(l.qty + qty) } : l,
  );
}

/** Задать количество позиции; 0 и меньше — позиция удаляется. */
export function setLineQty(
  lines: readonly CartLine[],
  key: string,
  qty: number,
): CartLine[] {
  if (!(qty >= 1)) return removeLine(lines, key);
  return lines.map((l) =>
    lineKey(l) === key ? { ...l, qty: clampQty(qty) } : l,
  );
}

export function removeLine(
  lines: readonly CartLine[],
  key: string,
): CartLine[] {
  return lines.filter((l) => lineKey(l) !== key);
}

/** Сколько штук блюда в корзине — во всех настройках (число на плитке). */
export function countOf(
  lines: readonly CartLine[],
  productSlug: string,
): number {
  return lines
    .filter((l) => l.productSlug === productSlug)
    .reduce((sum, l) => sum + l.qty, 0);
}

const isBase = (l: CartLine) =>
  l.variantId === null && l.addonIds.length === 0 && l.removedIds.length === 0;

/**
 * «−» на плитке: убирает 1 шт. базовой конфигурации (её и добавляет «+»),
 * а если базовой нет — из последней позиции этого блюда.
 */
export function decrementProduct(
  lines: readonly CartLine[],
  productSlug: string,
): CartLine[] {
  const own = lines.filter((l) => l.productSlug === productSlug);
  const target = own.find(isBase) ?? own.at(-1);
  if (!target) return [...lines];
  return setLineQty(lines, lineKey(target), target.qty - 1);
}

export interface CartSnapshot {
  city: CitySlug | null;
  lines: CartLine[];
}

const EMPTY: CartSnapshot = { city: null, lines: [] };

/**
 * Разбор того, что лежит в localStorage. Туда может попасть что угодно
 * (старая версия сайта, ручная правка) — битые позиции тихо выкидываются,
 * корзина без известного города считается пустой.
 */
export function parsePersistedCart(value: unknown): CartSnapshot {
  if (typeof value !== "object" || value === null) return { ...EMPTY };
  const { city, lines } = value as { city?: unknown; lines?: unknown };
  if (typeof city !== "string" || !isCitySlug(city) || !Array.isArray(lines)) {
    return { ...EMPTY };
  }
  let parsed: CartLine[] = [];
  for (const raw of lines) {
    const result = CartLineSchema.safeParse(raw);
    if (result.success) parsed = addLine(parsed, result.data, result.data.qty);
  }
  return { city, lines: parsed };
}
