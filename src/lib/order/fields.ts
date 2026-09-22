// Правила трёх полей заказа — имя, телефон, адрес (SPEC §3 шаг 5).
// Здесь только чистые функции, без zod: этот файл уезжает в браузер вместе
// с формой оформления, а полная библиотека zod весит 308 КБ разобранного
// кода. Серверная схема (src/lib/order/schema.ts) строится на этих же
// функциях, поэтому форма и сервер проверяют ввод одинаково — правило
// написано один раз.
import { normalizePhone } from "./phone";

export const NAME_MIN = 2;
export const NAME_MAX = 40;
export const ADDRESS_MAX = 120;
export const MAX_LINES = 50;

/** Сколько знаков принимаем на вход до приведения (дальше — отказ). */
export const NAME_RAW_MAX = 200;
export const ADDRESS_RAW_MAX = 500;
export const PHONE_RAW_MAX = 32;

/** Диапазоны кодов управляющих и «невидимых» символов (в т.ч. разворот текста). */
const INVISIBLE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x001f],
  [0x007f, 0x009f],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x206f],
  [0xfeff, 0xfeff],
];

export function hasInvisible(value: string): boolean {
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
export const tidy = (value: string) => value.replace(/\s+/g, " ").trim();

/** Имя в том виде, в каком оно уйдёт в базу; не подходит — null. */
export function normalizeName(raw: string): string | null {
  if (raw.length > NAME_RAW_MAX || hasInvisible(raw)) return null;
  const name = tidy(raw);
  if (name.length < NAME_MIN || name.length > NAME_MAX) return null;
  return NAME_CHARS.test(name) ? name : null;
}

/** Адрес в том виде, в каком он уйдёт в базу; не подходит — null.
 *  Пустая строка — это «адреса нет», она допустима. */
export function normalizeAddress(raw: string): string | null {
  if (raw.length > ADDRESS_RAW_MAX || hasInvisible(raw)) return null;
  const address = tidy(raw);
  return address.length > ADDRESS_MAX ? null : address;
}

/** Телефон Молдовы в виде +373XXXXXXXX; не подходит — null. */
export function normalizeOrderPhone(raw: string): string | null {
  return raw.length > PHONE_RAW_MAX ? null : normalizePhone(raw);
}

export type OrderField = "name" | "phone" | "address";

const CHECKS: Record<OrderField, (raw: string) => string | null> = {
  name: normalizeName,
  phone: normalizeOrderPhone,
  address: normalizeAddress,
};

/** Ошибка одного поля для подписи под ним (null — всё хорошо). */
export function fieldError(
  field: OrderField,
  value: string,
): OrderField | null {
  return CHECKS[field](value) === null ? field : null;
}
