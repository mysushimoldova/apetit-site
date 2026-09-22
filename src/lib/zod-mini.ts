// Лёгкий zod («zod/mini», тот же пакет zod) — для схем, которые нужны в
// браузере на странице меню (корзина). Обычный zod тянет в меню ~90 КБ
// скриптов целиком; из mini в сборку попадают только используемые функции.
// Поэтому — именованные импорты, не `import * as z`: объект со всеми
// функциями сборщик не умеет урезать, и в меню снова уехал бы весь mini.
// Схемы mini и обычного zod совместимы (общее ядро): серверная схема заказа
// вкладывает в себя CartLineSchema как есть.
// jitless — как в src/lib/zod.ts: наш CSP запрещает eval (настройка общая).
import { config } from "zod/mini";

config({ jitless: true });

export {
  array,
  gte,
  int,
  lte,
  maxLength,
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
  trim,
  type output,
} from "zod/mini";
