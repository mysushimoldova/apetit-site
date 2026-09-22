// Текст на двух языках (SPEC §7) — на лёгком zod/mini: эта схема лежит
// внутри снимка заказа (src/lib/order/receipt.ts), а он нужен в браузере на
// оформлении и на экране подтверждения. Полный zod туда уезжать не должен.
// Схемы mini и обычного zod совместимы, поэтому остальные схемы меню
// (src/data/menu/schema.ts) вкладывают её в себя как есть.
import {
  array,
  minLength,
  object,
  string,
  trim,
  type output,
} from "@/lib/zod-mini";

const text = string().check(trim(), minLength(1));

/** Название на ro и ru. */
export const LocalizedSchema = object({ ro: text, ru: text });
export type Localized = output<typeof LocalizedSchema>;

/** Список ингредиентов на двух языках (одинаковой длины — есть тест). */
export const LocalizedListSchema = object({
  ro: array(text),
  ru: array(text),
});
export type LocalizedList = output<typeof LocalizedListSchema>;
