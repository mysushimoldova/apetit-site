import { Manrope, Montserrat, Oswald } from "next/font/google";

// Три фирменных шрифта (DESIGN.md → Tokens — Typography).
// next/font скачивает файлы при сборке и раздаёт их с нашего сервера:
// браузер ничего не запрашивает у Google.
// subsets — какие наборы знаков грузить заранее (preload): latin + latin-ext
// (румынские ș ț ă â î) — на них главные страницы. Кириллица (русский) в CSS
// тоже есть, но без preload: браузер берёт её, только когда на странице есть
// русский текст, — румынские страницы не качают лишние ~42 КБ.
// next/font читает параметры при сборке, поэтому значения должны быть
// написаны буквально — общую константу он не понимает.

/** Oswald 600 — заголовки категорий, города, номер заказа. Всегда заглавными. */
export const oswald = Oswald({
  weight: ["600"],
  // Только latin: Oswald набирает названия категорий и городов (KEBAB,
  // GÖZLEME, SOROCA…) — в них нет ș ț ă; latin-ext подгрузится сам, если нужен
  subsets: ["latin"],
  display: "swap",
  variable: "--font-oswald",
});

/** Manrope 600/700/800 — названия блюд, цены, кнопки, чипы. */
export const manrope = Manrope({
  weight: ["600", "700", "800"],
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-manrope",
});

/** Montserrat 400/500 — состав, описания, формы, подвал.
 *  preload: false — файлы Montserrat самые тяжёлые (104 КБ на два набора
 *  знаков), а на первом экране им набран только мелкий текст: состав и
 *  граммы. Если качать их сразу, они отбирают канал у Oswald, которым
 *  набрано слово-вывеска — а это самый большой элемент экрана (LCP).
 *  Шрифт всё равно загрузится, просто следующей очередью; подмена
 *  незаметна (display: swap и подогнанный запасной шрифт — без сдвигов). */
export const montserrat = Montserrat({
  weight: ["400", "500"],
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
  variable: "--font-montserrat",
});

/** Все CSS-переменные шрифтов одной строкой — вешается на <html>. */
export const fontVariables = `${oswald.variable} ${manrope.variable} ${montserrat.variable}`;
