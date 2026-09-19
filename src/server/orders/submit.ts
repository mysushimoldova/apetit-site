// Приём заказа (SPEC §3 шаг 5, §9.3, §9.4). Одна функция, в которую следующая
// задача добавит Telegram и Supabase — форма и Server Action не меняются.
//
// Порядок проверок: вход (zod) → ловушка для ботов → точка есть и принимает
// заказы → рабочие часы точки → каждая позиция продаётся в точке и собрана
// из разрешённого (размер, добавки, «без») → повтор за 2 минуты (тот же номер)
// → лимиты номера и IP → номер заказа → снимок → лог.
// Цена считается здесь, по каталогу точки; сумм от клиента нет и не
// принимается (OrderInputSchema — strictObject).
import { getPoint as getRealPoint, type Point } from "@/data/points";
import { buildPointCatalog } from "@/lib/cart/catalog";
import { lineParts } from "@/lib/cart/describe";
import { lineKey, type CartLine } from "@/lib/cart/lines";
import { priceLine, type Catalog } from "@/lib/cart/pricing";
import { isOpenAt, type Hours } from "@/lib/order/hours";
import { OrderInputSchema, type OrderField } from "@/lib/order/schema";
import type { OrderMemory } from "./memory";
import type { OrderReceipt, ReceiptLine } from "@/lib/order/receipt";

export type SubmitResult =
  | { ok: true; receipt: OrderReceipt }
  | { ok: false; code: "invalid"; fields: OrderField[] }
  | { ok: false; code: "closed"; hours: Hours }
  | { ok: false; code: "point_paused" }
  | { ok: false; code: "unavailable"; lines: number[] }
  | { ok: false; code: "rate_limited" }
  /** Мусор, неизвестная точка, ловушка — без подробностей */
  | { ok: false; code: "rejected" };

export interface SubmitContext {
  now: Date;
  /** IP клиента — только из надёжного источника (cf-connecting-ip); null — не знаем */
  ip: string | null;
  memory: OrderMemory;
  log: (message: string, data: Record<string, unknown>) => void;
  /** Подмена в тестах (точка на паузе) */
  getPoint?: (id: string) => Point | undefined;
}

const FIELDS: readonly OrderField[] = ["name", "phone", "address"];

// Каталоги точек не меняются, пока данные в коде (до Supabase)
const catalogs = new Map<string, Catalog>();
function catalogOf(pointId: string): Catalog {
  let catalog = catalogs.get(pointId);
  if (!catalog) {
    catalog = buildPointCatalog(pointId, { photos: false });
    catalogs.set(pointId, catalog);
  }
  return catalog;
}

/** «+37367111222» → «+373 67 *** 222» — в логах без полного номера. */
function maskPhone(phone: string): string {
  return `${phone.slice(0, 4)} ${phone.slice(4, 6)} *** ${phone.slice(-3)}`;
}

/** Одинаковый заказ = та же точка и тот же состав с количествами. */
function fingerprint(pointId: string, lines: readonly CartLine[]): string {
  const parts = lines.map((l) => `${lineKey(l)}*${l.qty}`).sort();
  return `${pointId}#${parts.join(";")}`;
}

function receiptLine(line: CartLine, catalog: Catalog): ReceiptLine | null {
  const price = priceLine(line, catalog);
  const parts = lineParts(line, catalog);
  const product = catalog.products[line.productSlug];
  if (!price || !parts || !product) return null;
  return {
    name: product.name,
    ...parts,
    qty: line.qty,
    unit: price.unit,
    total: price.total,
  };
}

export async function submitOrder(
  raw: unknown,
  ctx: SubmitContext,
): Promise<SubmitResult> {
  const parsed = OrderInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fields = new Set<OrderField>();
    let other = false;
    for (const issue of parsed.error.issues) {
      const field = FIELDS.find((f) => f === issue.path[0]);
      if (field) fields.add(field);
      else other = true;
    }
    // Сломан не текст полей, а сама структура — это не человек с формой
    if (other || fields.size === 0) return { ok: false, code: "rejected" };
    return {
      ok: false,
      code: "invalid",
      fields: FIELDS.filter((f) => fields.has(f)),
    };
  }
  const input = parsed.data;

  // Ловушка для ботов (SPEC §9.4): человек поле не видит
  if (input.website !== "") return { ok: false, code: "rejected" };

  const point = (ctx.getPoint ?? getRealPoint)(input.pointId);
  if (!point) return { ok: false, code: "rejected" };
  if (!point.acceptingOrders) return { ok: false, code: "point_paused" };
  if (!isOpenAt(ctx.now, point.hours)) {
    return { ok: false, code: "closed", hours: point.hours };
  }

  const catalog = catalogOf(point.id);
  const lines: ReceiptLine[] = [];
  const unavailable: number[] = [];
  input.lines.forEach((line, i) => {
    const priced = receiptLine(line, catalog);
    if (priced) lines.push(priced);
    else unavailable.push(i);
  });
  if (unavailable.length > 0) {
    return { ok: false, code: "unavailable", lines: unavailable };
  }

  const now = ctx.now.getTime();
  const print = fingerprint(point.id, input.lines);
  const duplicate = ctx.memory.findDuplicate(input.phone, print, now);
  if (duplicate) return { ok: true, receipt: duplicate };

  if (!ctx.memory.allows(input.phone, ctx.ip, now)) {
    return { ok: false, code: "rate_limited" };
  }

  const receipt = ctx.memory.commit(input.phone, ctx.ip, print, now, (n) => ({
    number: n,
    pointId: point.id,
    pointName: point.name,
    pointPhone: point.phone,
    city: point.citySlug,
    lines,
    total: lines.reduce((sum, l) => sum + l.total, 0),
    createdAt: ctx.now.toISOString(),
  }));

  // TODO (следующая задача): сообщение в Telegram точке и запись в Supabase.
  // Здесь же будут имя, телефон и адрес клиента — в лог их не пишем.
  // Для Telegram (parse_mode HTML) имя и адрес экранировать: < > & — их
  // схема для адреса не запрещает. Заказ в базе не отдавать по одному номеру
  // без проверки: номера сквозные, их легко перебрать.
  ctx.log("order accepted", {
    number: receipt.number,
    point: receipt.pointId,
    total: receipt.total,
    lines: receipt.lines.length,
    phone: maskPhone(input.phone),
    address: input.address !== "",
  });

  return { ok: true, receipt };
}
