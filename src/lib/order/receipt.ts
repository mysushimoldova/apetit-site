// Снимок принятого заказа (SPEC §9.3: «заказ хранит снимок: названия, цены,
// добавки на момент заказа»). Сервер возвращает его после приёма и кладёт в
// orders.items; браузер держит копию в sessionStorage вкладки, чтобы
// показать экран подтверждения (прочитанное проверяется этой же схемой).
//
// Схема — на лёгком zod/mini: она нужна и в браузере (оформление и экран
// подтверждения), а полный zod весит 308 КБ разобранного кода. Схемы mini и
// обычного zod совместимы, поэтому сервер вкладывает её в свои схемы как есть.
import {
  array,
  gte,
  int,
  minLength,
  nonnegative,
  nullable,
  object,
  pipe,
  positive,
  refine,
  regex,
  string,
  transform,
  type output,
} from "@/lib/zod-mini";
import { LocalizedSchema } from "@/data/menu/localized";
import { isCitySlug, type CitySlug } from "@/data/points";

const money = int().check(nonnegative());

export const ReceiptLineSchema = object({
  name: LocalizedSchema,
  variant: nullable(LocalizedSchema),
  /** Добавки в блюдо */
  extra: array(LocalizedSchema),
  /** Соусы в стаканчике отдельно */
  cups: array(LocalizedSchema),
  /** Убранные ингредиенты */
  without: array(LocalizedSchema),
  qty: int().check(gte(1)),
  /** Цена 1 шт. и позиции — посчитаны сервером */
  unit: money,
  total: money,
});
export type ReceiptLine = output<typeof ReceiptLineSchema>;

export const ReceiptSchema = object({
  number: int().check(positive()),
  pointId: string(),
  pointName: string(),
  /** Формат точки: 0XXXXXXXX (идёт в ссылку tel: — только цифры) */
  pointPhone: string().check(regex(/^0[0-9]{8}$/)),
  city: pipe(
    string().check(refine(isCitySlug)),
    transform((c) => c as CitySlug),
  ),
  lines: array(ReceiptLineSchema).check(minLength(1)),
  total: money,
  /** ISO-время приёма */
  createdAt: string(),
});
export type OrderReceipt = output<typeof ReceiptSchema>;

const storageKey = (n: number) => `apetit.order.${n}`;

/** Сохранить снимок для экрана подтверждения (нет хранилища — не страшно). */
export function saveReceipt(receipt: OrderReceipt): void {
  try {
    window.sessionStorage.setItem(
      storageKey(receipt.number),
      JSON.stringify(receipt),
    );
  } catch {
    // приватный режим / нет места — экран подтверждения уйдёт в меню
  }
}

/** Сырой снимок из хранилища (строка стабильна — годится для useSyncExternalStore). */
export function readReceiptRaw(n: number): string | null {
  try {
    return window.sessionStorage.getItem(storageKey(n));
  } catch {
    return null;
  }
}

/** Разобрать снимок: битый, чужой номер или город → null. */
export function parseReceipt(
  raw: string | null,
  n: number,
  city: CitySlug,
): OrderReceipt | null {
  if (raw === null) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const r = ReceiptSchema.safeParse(json);
  if (!r.success || r.data.number !== n || r.data.city !== city) return null;
  return r.data;
}
