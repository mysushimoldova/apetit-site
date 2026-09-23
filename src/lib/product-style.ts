// Переменные CSS для карточек блюд: тень под фото и появление при прокрутке.
// Числа выбирает Амян в панели /dev/motion, лежат в src/config/motion.json,
// раздел "products" (см. src/motion/config-schema.ts).
//
// Как это попадает на страницу: корневой layout ставит переменные на <html>,
// а сами правила (форма тени, переходы) лежат в globals.css. Так значения
// меняются сразу на всех страницах, а панель /dev/motion может переписать их
// на живой странице теми же именами (applyProductStyle).
import type { CSSProperties } from "react";
import type {
  ProductRevealSettings,
  ProductShadowSettings,
  ProductsSettings,
} from "@/motion/config-schema";

/** Тёплый чёрный (DESIGN.md → Colors) и рыжий — между ними ползунок «tint».
 *  Та же формула, что в демо docs/motion/produse-demo.html (функция mix). */
const TINT_COLD: [number, number, number] = [26, 23, 20];
const TINT_WARM: [number, number, number] = [92, 52, 22];

/** Цвет тени как «R G B» — для rgb(var(--sh-tint) / alpha). */
export function shadowTint(t: number): string {
  return TINT_COLD.map((v, i) => Math.round(v + (TINT_WARM[i] - v) * t)).join(
    " ",
  );
}

/** С чего начинает фото и тень до появления. Значения подставляются прямо в
 *  transform, поэтому «none» — это тоже допустимое значение. */
function revealFrom(reveal: ProductRevealSettings): {
  photo: string;
  shadow: string;
} {
  if (reveal.type === "lift") {
    return { photo: `translateY(${reveal.dist}px)`, shadow: "scaleX(0.8)" };
  }
  if (reveal.type === "scale") {
    return { photo: "scale(0.94)", shadow: "scaleX(0.7)" };
  }
  return { photo: "none", shadow: "none" };
}

function shadowVars(shadow: ProductShadowSettings): Record<string, string> {
  return {
    "--sh-tint": shadowTint(shadow.tint),
    "--sh-aw": `${shadow.aw}%`,
    "--sh-ah": `${shadow.ah}px`,
    "--sh-ab": `${shadow.ab}px`,
    "--sh-aa": String(shadow.aa),
    "--sh-cw": `${shadow.cw}%`,
    "--sh-ch": `${shadow.ch}px`,
    "--sh-cb": `${shadow.cb}px`,
    "--sh-ca": String(shadow.ca),
    "--sh-y": `${shadow.y}px`,
  };
}

/** Переменные CSS для <html>. */
export function productVars(
  products: ProductsSettings,
): Record<string, string> {
  const from = revealFrom(products.reveal);
  return {
    ...shadowVars(products.shadow),
    "--pv-dur": `${products.reveal.dur}ms`,
    "--pv-shadow-delay": `${products.reveal.shadowDelay}ms`,
    // Без единиц: это число читает RevealGrid, а не сам CSS
    "--pv-stagger": String(products.reveal.stagger),
    "--pv-photo-from": from.photo,
    "--pv-shadow-from": from.shadow,
  };
}

/** То же для атрибута style в React (переменных CSS нет в типе). */
export function productStyle(products: ProductsSettings): CSSProperties {
  return productVars(products) as CSSProperties;
}

/** Минимум, который нужен от элемента — как в src/lib/page-theme.ts. */
type StyleTarget = {
  style: { setProperty(name: string, value: string): void };
};

/** Применить настройки к живой странице — нужно только панели /dev/motion. */
export function applyProductStyle(
  element: StyleTarget,
  products: ProductsSettings,
): void {
  for (const [name, value] of Object.entries(productVars(products))) {
    element.style.setProperty(name, value);
  }
}
