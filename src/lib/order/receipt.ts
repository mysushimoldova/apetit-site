// Снимок принятого заказа (SPEC §9.3: «заказ хранит снимок: названия, цены,
// добавки на момент заказа»). Сервер возвращает его после приёма; клиент
// показывает экран подтверждения. Базы ещё нет — снимок живёт в
// sessionStorage вкладки (прочитанное проверяется этой же схемой).
// Следующая задача отправит его в Telegram и запишет в Supabase.
import { z } from "@/lib/zod";
import { LocalizedSchema } from "@/data/menu/schema";
import { isCitySlug, type CitySlug } from "@/data/points";

const money = z.number().int().nonnegative();

export const ReceiptLineSchema = z.object({
  name: LocalizedSchema,
  variant: LocalizedSchema.nullable(),
  /** Добавки в блюдо */
  extra: z.array(LocalizedSchema),
  /** Соусы в стаканчике отдельно */
  cups: z.array(LocalizedSchema),
  /** Убранные ингредиенты */
  without: z.array(LocalizedSchema),
  qty: z.number().int().min(1),
  /** Цена 1 шт. и позиции — посчитаны сервером */
  unit: money,
  total: money,
});
export type ReceiptLine = z.infer<typeof ReceiptLineSchema>;

export const ReceiptSchema = z.object({
  number: z.number().int().positive(),
  pointId: z.string(),
  pointName: z.string(),
  /** Формат точки: 0XXXXXXXX (идёт в ссылку tel: — только цифры) */
  pointPhone: z.string().regex(/^0[0-9]{8}$/),
  city: z
    .string()
    .refine(isCitySlug)
    .transform((c) => c as CitySlug),
  lines: z.array(ReceiptLineSchema).min(1),
  total: money,
  /** ISO-время приёма */
  createdAt: z.string(),
});
export type OrderReceipt = z.infer<typeof ReceiptSchema>;

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
