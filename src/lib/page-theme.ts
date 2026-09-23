// Цвет фона страницы (DESIGN.md → Surfaces, уровень 0). Значение выбирает
// Амян в панели /dev/motion, хранится в src/config/motion.json, раздел "page".
//
// Как это попадает на страницу: корневой layout собирает из этих значений
// правило :root и выводит его в <style> (src/lib/root-css.ts) — сам цвет и
// два полупрозрачных от него же для стекла (шапка, панель корзины, оверлей
// города). В globals.css эти переменные объявлены со значением по умолчанию,
// правило со страницы их переопределяет, поэтому цвет меняется сразу
// на всех страницах и во всех местах.
//
// На атрибут style у <html> эти переменные НЕ ставятся: из-за этого ломалась
// гидратация (подробности — в шапке src/lib/root-css.ts). Исключение одно —
// applyPageTheme ниже: панель /dev/motion меняет цвет на живой странице уже
// после монтирования, и инлайновое значение перебивает правило :root.

/** Прозрачность стекла (DESIGN.md → Surfaces, уровень 2) и запасного
 *  варианта для браузеров без размытия. */
const GLASS_ALPHA = 0.78;
const GLASS_FALLBACK_ALPHA = 0.96;

/** «#F4EDE2» → [244, 237, 226]. Цвет берётся из схемы (zod, список из
 *  четырёх вариантов), поэтому разбор простой. */
function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Переменные CSS для правила :root: фон страницы и стекло от него же. */
export function pageThemeVars(background: string): Record<string, string> {
  const [r, g, b] = hexToRgb(background);
  return {
    "--color-cream": background,
    "--glass-bg": `rgba(${r}, ${g}, ${b}, ${GLASS_ALPHA})`,
    "--glass-bg-fallback": `rgba(${r}, ${g}, ${b}, ${GLASS_FALLBACK_ALPHA})`,
  };
}

/** Минимум, который нужен от элемента: у настоящего HTMLElement это и есть
 *  style. Так функция проверяется тестом без настоящего браузера. */
type StyleTarget = {
  style: { setProperty(name: string, value: string): void };
};

/** Применить цвет к живой странице. Нужно только панели /dev/motion:
 *  она показывает страницу в рамке и меняет цвет без перезагрузки. */
export function applyPageTheme(element: StyleTarget, background: string): void {
  for (const [name, value] of Object.entries(pageThemeVars(background))) {
    element.style.setProperty(name, value);
  }
}
