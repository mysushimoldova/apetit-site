// Приём заказа (SPEC §3 шаг 5, §9.3, §9.4). Одна функция, в которую следующая
// задача добавит Telegram — форма и Server Action не меняются.
//
// Порядок проверок: вход (zod) → ловушка для ботов → точка есть и принимает
// заказы → рабочие часы точки → каждая позиция продаётся в точке и собрана
// из разрешённого (размер, добавки, «без») → повтор за 2 минуты (тот же номер
// из базы) → лимиты номера и IP (запросы по индексам) → один INSERT, номер
// выдаёт sequence базы → снимок → лог.
// Цена считается здесь, по каталогу точки; сумм от клиента нет и не
// принимается (OrderInputSchema — strictObject).
import { getPoint as getRealPoint, type Point } from "@/data/points";
import { buildPointCatalog } from "@/lib/cart/catalog";
import { lineParts } from "@/lib/cart/describe";
import { lineKey, type CartLine } from "@/lib/cart/lines";
import { priceLine, type Catalog } from "@/lib/cart/pricing";
import { isOpenAt, type Hours } from "@/lib/order/hours";
import { OrderInputSchema, type OrderField } from "@/lib/order/schema";
import {
  ReceiptLineSchema,
  type OrderReceipt,
  type ReceiptLine,
} from "@/lib/order/receipt";
import { z } from "@/lib/zod";
import { sha256Hex } from "./hash";
import {
  DEDUP_MS,
  IP_LIMIT,
  PHONE_LIMIT,
  StoreError,
  type OrderStore,
} from "./store";

export type SubmitResult =
  | { ok: true; receipt: OrderReceipt }
  | { ok: false; code: "invalid"; fields: OrderField[] }
  | { ok: false; code: "closed"; hours: Hours }
  | { ok: false; code: "point_paused" }
  | { ok: false; code: "unavailable"; lines: number[] }
  | { ok: false; code: "rate_limited" }
  /** База не ответила — форма показывает «попробуй ещё раз» */
  | { ok: false; code: "db_error" }
  /** Мусор, неизвестная точка, ловушка — без подробностей */
  | { ok: false; code: "rejected" };

export interface SubmitContext {
  now: Date;
  /** IP клиента — только из надёжного источника (cf-connecting-ip); null — не знаем */
  ip: string | null;
  store: OrderStore;
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

/** Снимок позиций из базы; битый (не должно быть) — null, возьмём свежий. */
const StoredLinesSchema = z.array(ReceiptLineSchema).min(1);

/** Что писать в лог об ошибке базы: шаг, код, текст — без данных заказа. */
function describeDbError(error: unknown): Record<string, unknown> {
  if (error instanceof StoreError) {
    return { step: error.step, code: error.code, message: error.message };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { step: "unknown", message };
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

  const total = lines.reduce((sum, l) => sum + l.total, 0);
  const receipt = (
    number: number,
    createdAt: string,
    snapshot: { lines: ReceiptLine[]; total: number },
  ): OrderReceipt => ({
    number,
    pointId: point.id,
    pointName: point.name,
    pointPhone: point.phone,
    city: point.citySlug,
    lines: snapshot.lines,
    total: snapshot.total,
    createdAt,
  });

  const since = (windowMs: number) => new Date(ctx.now.getTime() - windowMs);
  const dedupHash = await sha256Hex(
    `${input.phone}|${fingerprint(point.id, input.lines)}`,
  );
  const ipHash = ctx.ip === null ? null : await sha256Hex(ctx.ip);

  try {
    // Тот же телефон и тот же состав за 2 минуты — вернуть записанный заказ
    const recent = await ctx.store.findRecent(dedupHash, since(DEDUP_MS));
    if (recent) {
      const stored = StoredLinesSchema.safeParse(recent.items);
      return {
        ok: true,
        receipt: receipt(
          recent.number,
          recent.createdAt,
          stored.success
            ? { lines: stored.data, total: recent.total }
            : { lines, total },
        ),
      };
    }

    const byPhone = await ctx.store.countByPhone(
      input.phone,
      since(PHONE_LIMIT.windowMs),
    );
    if (byPhone >= PHONE_LIMIT.max) return { ok: false, code: "rate_limited" };
    if (ipHash !== null) {
      const byIp = await ctx.store.countByIp(ipHash, since(IP_LIMIT.windowMs));
      if (byIp >= IP_LIMIT.max) return { ok: false, code: "rate_limited" };
    }

    const inserted = await ctx.store.insert({
      pointId: point.id,
      city: point.citySlug,
      lang: point.locale,
      name: input.name,
      phone: input.phone,
      address: input.address === "" ? null : input.address,
      items: lines,
      total,
      ipHash,
      dedupHash,
      createdAt: ctx.now,
    });

    // TODO (следующая задача): сообщение в Telegram точке, telegram_message_id
    // в строку заказа. Имя и адрес экранировать (parse_mode HTML). Заказ из
    // базы не отдавать по одному номеру без проверки: номера сквозные.
    ctx.log("order accepted", {
      number: inserted.number,
      point: point.id,
      total,
      lines: lines.length,
      phone: maskPhone(input.phone),
      address: input.address !== "",
    });

    return {
      ok: true,
      receipt: receipt(inserted.number, inserted.createdAt, { lines, total }),
    };
  } catch (error) {
    // Клиенту — «попробуй ещё раз»; в лог — причина, без данных заказа
    ctx.log("db error", describeDbError(error));
    return { ok: false, code: "db_error" };
  }
}
