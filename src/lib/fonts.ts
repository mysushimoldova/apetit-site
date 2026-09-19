import { Manrope, Montserrat, Oswald } from "next/font/google";

// Три фирменных шрифта (DESIGN.md → Tokens — Typography).
// next/font скачивает файлы при сборке и раздаёт их с нашего сервера:
// браузер ничего не запрашивает у Google.
// Subsets: latin + latin-ext (румынские ș ț ă â î) + cyrillic (русский).
// next/font читает параметры при сборке, поэтому значения должны быть
// написаны буквально — общую константу он не понимает.

/** Oswald 600 — заголовки категорий, города, номер заказа. Всегда заглавными. */
export const oswald = Oswald({
  weight: ["600"],
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  variable: "--font-oswald",
});

/** Manrope 600/700/800 — названия блюд, цены, кнопки, чипы. */
export const manrope = Manrope({
  weight: ["600", "700", "800"],
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  variable: "--font-manrope",
});

/** Montserrat 400/500 — состав, описания, формы, подвал. */
export const montserrat = Montserrat({
  weight: ["400", "500"],
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  variable: "--font-montserrat",
});

/** Все CSS-переменные шрифтов одной строкой — вешается на <html>. */
export const fontVariables = `${oswald.variable} ${manrope.variable} ${montserrat.variable}`;
