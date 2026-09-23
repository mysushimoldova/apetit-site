// Переменные CSS из src/config/motion.json — одной строкой для <style>,
// который корневой layout выводит в начале <body> (src/routes/root.tsx).
//
// Почему не атрибут style у <html>, как было раньше. React при гидрации
// сверяет атрибут style побуквенно с тем, что он собрал сам. Стоит любому
// коду до гидрации тронуть style корневого элемента (блокировка прокрутки
// у листа, панель /dev/motion, расширение браузера в Safari), как браузер
// переписывает атрибут по-своему — с пробелами после двоеточий, — и React
// ругается «A tree hydrated but some attributes… didn't match». Значения при
// этом одни и те же: расходится только запись. Правило простое: у <html>
// атрибута style нет вовсе, сверять нечего, ошибка невозможна.
//
// Источник значений — один: motion.json, прочитанный на сервере. Клиент при
// гидрации ничего не пересчитывает; панель /dev/motion меняет те же
// переменные уже после монтирования, ставя их прямо на <html> (инлайновое
// значение сильнее правила :root — см. src/lib/page-theme.ts).
import type { ProductsSettings } from "@/motion/config-schema";
import { pageThemeVars } from "./page-theme";
import { productVars } from "./product-style";

/**
 * Содержимое <style> браузер берёт как есть, поэтому каждое значение
 * проходит через сито. Законных значений это не касается: в них только
 * числа, единицы, цвета и градиенты — ни угловых скобок, ни фигурных, ни
 * точки с запятой там быть не может.
 *
 * Что чем опасно: «<» закрыло бы сам <style> и дальше пошла бы разметка,
 * «}» закрыло бы правило :root и позволило бы дописать свои правила,
 * «;» — лишнее свойство внутри :root. Значения приходят из motion.json,
 * а туда пишет только панель /dev/motion, и только через проверку схемой
 * zod (числа в границах, цвета из списка). Сито — второй рубеж на случай,
 * если файл поправят руками.
 */
const safeValue = (value: string) => value.replace(/[<>{};]/g, "");

/** Правило :root со всеми переменными страницы и карточек блюд. */
export function rootCss(
  background: string,
  products: ProductsSettings,
): string {
  const vars = { ...pageThemeVars(background), ...productVars(products) };
  const body = Object.entries(vars)
    .map(([name, value]) => `${safeValue(name)}:${safeValue(value)}`)
    .join(";");
  return `:root{${body}}`;
}
