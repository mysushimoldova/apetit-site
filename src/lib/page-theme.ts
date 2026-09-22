// Цвет фона страницы (DESIGN.md → Surfaces, уровень 0). Значение выбирает
// Амян в панели /dev/motion, хранится в src/config/motion.json, раздел "page".
//
// Как это попадает на страницу: корневой layout ставит на <html> три
// переменные CSS — сам цвет и два полупрозрачных от него же для стекла
// (шапка, панель корзины, оверлей города). В globals.css эти переменные
// объявлены со значением по умолчанию, здесь они только переопределяются,
// поэтому цвет меняется сразу на всех страницах и во всех местах.
import type { CSSProperties } from "react";

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

/** Переменные CSS для <html>: фон страницы и стекло от него же. */
export function pageThemeVars(background: string): Record<string, string> {
  const [r, g, b] = hexToRgb(background);
  return {
    "--color-cream": background,
    "--glass-bg": `rgba(${r}, ${g}, ${b}, ${GLASS_ALPHA})`,
    "--glass-bg-fallback": `rgba(${r}, ${g}, ${b}, ${GLASS_FALLBACK_ALPHA})`,
  };
}

/** То же для атрибута style в React: переменные CSS там разрешены, но в типе
 *  CSSProperties их нет — отсюда приведение типа. */
export function pageThemeStyle(background: string): CSSProperties {
  return pageThemeVars(background) as CSSProperties;
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
