// Вход заказа (SPEC §3 шаг 5, §9.3, §9.4) — одна zod-схема для формы и
// сервера. Клиент присылает только состав (id и количество) и контакты;
// лишние поля (сумма, цена) — отказ: цену считает только сервер.
import { z } from "zod";
import { CartLineSchema } from "@/lib/cart/lines";
import { normalizePhone } from "./phone";

export const NAME_MIN = 2;
export const NAME_MAX = 40;
export const ADDRESS_MAX = 120;
export const MAX_LINES = 50;

/** Управляющие и «невидимые» символы (в т.ч. разворот текста) — запрещены. */
/** Диапазоны кодов управляющих и «невидимых» символов (в т.ч. разворот текста). */
const INVISIBLE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x001f],
  [0x007f, 0x009f],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x206f],
  [0xfeff, 0xfeff],
];
function hasInvisible(value: string): boolean {
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (INVISIBLE_RANGES.some(([from, to]) => code >= from && code <= to)) {
      return true;
    }
  }
  return false;
}
/** Буквы любого алфавита, пробел, дефис, апостроф (' и U+2019), точка. */
const NAME_CHARS = /^\p{L}[\p{L}\p{M} '’.\-]*$/u;

/** Пробелы по краям убраны, несколько пробелов подряд — один. */
const tidy = (value: string) => value.replace(/\s+/g, " ").trim();

export const NameSchema = z
  .string()
  .max(200)
  .refine((v) => !hasInvisible(v))
  .transform(tidy)
  .pipe(z.string().min(NAME_MIN).max(NAME_MAX).regex(NAME_CHARS));

export const PhoneSchema = z
  .string()
  .max(32)
  .transform((v, ctx) => {
    const phone = normalizePhone(v);
    if (phone === null) {
      ctx.addIssue({ code: "custom", message: "phone" });
      return z.NEVER;
    }
    return phone;
  });

export const AddressSchema = z
  .string()
  .max(500)
  .refine((v) => !hasInvisible(v))
  .transform(tidy)
  .pipe(z.string().max(ADDRESS_MAX));

export const OrderInputSchema = z.strictObject({
  pointId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  lines: z.array(CartLineSchema).min(1).max(MAX_LINES),
  name: NameSchema,
  phone: PhoneSchema,
  address: AddressSchema,
  /** Поле-ловушка для ботов (SPEC §9.4): человек его не видит и не заполняет. */
  website: z.string().max(500),
});
export type OrderInput = z.infer<typeof OrderInputSchema>;

export type OrderField = "name" | "phone" | "address";

const FIELD_SCHEMAS = {
  name: NameSchema,
  phone: PhoneSchema,
  address: AddressSchema,
} as const;

/** Ошибка одного поля для подписи под ним (null — всё хорошо). */
export function fieldError(
  field: OrderField,
  value: string,
): OrderField | null {
  return FIELD_SCHEMAS[field].safeParse(value).success ? null : field;
}
