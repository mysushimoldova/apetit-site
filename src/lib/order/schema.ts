// Вход заказа (SPEC §3 шаг 5, §9.3, §9.4) — серверная схема. Клиент присылает
// только состав (id и количество) и контакты; лишние поля (сумма, цена) —
// отказ: цену считает только сервер.
//
// Сами правила полей лежат в ./fields (обычные функции, без zod): их же
// использует форма в браузере, поэтому проверка на экране и на сервере — одно
// и то же правило, написанное один раз. Полный zod остаётся здесь, на
// сервере: в браузер он не уезжает.
import { z } from "@/lib/zod";
import { CartLineSchema } from "@/lib/cart/lines";
import {
  MAX_LINES,
  NAME_RAW_MAX,
  ADDRESS_RAW_MAX,
  PHONE_RAW_MAX,
  normalizeAddress,
  normalizeName,
  normalizeOrderPhone,
} from "./fields";

export {
  ADDRESS_MAX,
  MAX_LINES,
  NAME_MAX,
  NAME_MIN,
  fieldError,
  type OrderField,
} from "./fields";

/** Поле по правилу из ./fields: не прошло — своя пометка в issues. */
function field(rawMax: number, normalize: (raw: string) => string | null) {
  return z
    .string()
    .max(rawMax)
    .transform((value, ctx) => {
      const clean = normalize(value);
      if (clean === null) {
        ctx.addIssue({ code: "custom", message: "invalid" });
        return z.NEVER;
      }
      return clean;
    });
}

export const NameSchema = field(NAME_RAW_MAX, normalizeName);
export const PhoneSchema = field(PHONE_RAW_MAX, normalizeOrderPhone);
export const AddressSchema = field(ADDRESS_RAW_MAX, normalizeAddress);

export const OrderInputSchema = z.strictObject({
  pointId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  lines: z.array(CartLineSchema).min(1).max(MAX_LINES),
  name: NameSchema,
  phone: PhoneSchema,
  address: AddressSchema,
  /** Поле-ловушка для ботов (SPEC §9.4): человек его не видит и не заполняет. */
  website: z.string().max(500),
  /** Язык, на котором посетитель оформлял (переключатель RO/RU) — для Telegram и писем */
  lang: z.enum(["ro", "ru"]),
});
