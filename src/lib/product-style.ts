// Переменные CSS для карточек блюд: тень под фото и появление при прокрутке.
// Числа выбирает Амян в панели /dev/motion, лежат в src/config/motion.json,
// раздел "products" (см. src/motion/config-schema.ts).
//
// Как это попадает на страницу: корневой layout выводит переменные правилом
// :root в <style> (src/lib/root-css.ts), а сами правила (форма тени,
// переходы) лежат в globals.css. Так значения меняются сразу на всех
// страницах, а панель /dev/motion может переписать их на живой странице теми
// же именами (applyProductStyle) — уже после монтирования.
import type {
  ProductLiftSettings,
  ProductRevealSettings,
  ProductShadowSettings,
  ProductsSettings,
} from "@/motion/config-schema";
import { LIFT_MAX } from "@/motion/lift";

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

/** Округление, чтобы в CSS не уезжали хвосты вроде 0.15400000000000003. */
const alpha = (value: number) => String(Math.round(value * 1e4) / 1e4);

/**
 * Форма тени: доли непрозрачности на 0, 15, 30 … 100 процентах радиуса.
 *
 * Это профиль размытого гауссом эллипса, посчитанный численно и подогнанный
 * методом наименьших квадратов (задача 14): расхождение с настоящим
 * `filter: blur()` — меньше одного уровня яркости из 255. Две тени размыты
 * по-разному, поэтому и профиля два.
 */
const STOP_POSITIONS = [0, 15, 30, 45, 60, 75, 90, 100];
const AMBIENT_STOPS = [0.31, 0.297, 0.265, 0.214, 0.155, 0.094, 0.06, 0];
const CONTACT_STOPS = [0.511, 0.494, 0.449, 0.38, 0.295, 0.188, 0.107, 0];

function gradient(tint: string, opacity: number, stops: number[]): string {
  const parts = stops.map(
    (share, i) =>
      `rgb(${tint} / ${alpha(opacity * share)}) ${STOP_POSITIONS[i]}%`,
  );
  return `radial-gradient(closest-side, ${parts.join(", ")})`;
}

/**
 * Готовая картинка тени: два градиента в одном значении background-image
 * (сперва контактная, она сверху, потом широкая).
 *
 * Собирается здесь, а не в CSS переменными в каждом стопе: шестнадцать
 * `calc(var(...))` на элемент браузер пересчитывает при разборе стилей, и на
 * 47 плитках это заметно по времени до готовности страницы. Здесь же строка
 * считается один раз на всю страницу.
 */
function shadowImage(tint: string, ambient: number, contact: number): string {
  return `${gradient(tint, contact, CONTACT_STOPS)}, ${gradient(tint, ambient, AMBIENT_STOPS)}`;
}

/**
 * Насыщенность теней на полном подъёме — то, к чему перетекает тень, когда
 * страницу листают быстро (`lift` доходит до LIFT_MAX). Формулы из демо
 * docs/motion/produse-demo.html: широкая тень набирает, контактная уходит.
 *
 * Считается один раз при смене настроек, а не на кадре: на кадре движок
 * трогает только прозрачность двух готовых слоёв, и градиенты не
 * пересчитываются.
 */
function liftedShadow(
  shadow: ProductShadowSettings,
  lift: ProductLiftSettings,
): { ambient: number; contact: number } {
  const h = lift.shadowReact * LIFT_MAX;
  return {
    ambient: shadow.aa * (1 + 0.4 * h),
    contact: Math.max(0, shadow.ca * (1 - 0.9 * h)),
  };
}

function shadowVars(
  shadow: ProductShadowSettings,
  lift: ProductLiftSettings,
): Record<string, string> {
  const tint = shadowTint(shadow.tint);
  const lifted = liftedShadow(shadow, lift);
  return {
    "--sh-aw": `${shadow.aw}%`,
    "--sh-ah": `${shadow.ah}px`,
    "--sh-ab": `${shadow.ab}px`,
    "--sh-cw": `${shadow.cw}%`,
    "--sh-ch": `${shadow.ch}px`,
    "--sh-cb": `${shadow.cb}px`,
    "--sh-y": `${shadow.y}px`,
    // Тень в покое и та же тень на полном подъёме — готовыми картинками
    "--sh-image": shadowImage(tint, shadow.aa, shadow.ca),
    "--sh-image-lifted": shadowImage(tint, lifted.ambient, lifted.contact),
  };
}

/** Переменные CSS для правила :root. */
export function productVars(
  products: ProductsSettings,
): Record<string, string> {
  const from = revealFrom(products.reveal);
  return {
    ...shadowVars(products.shadow, products.lift),
    "--pv-dur": `${products.reveal.dur}ms`,
    "--pv-shadow-delay": `${products.reveal.shadowDelay}ms`,
    // Без единиц: это число читает RevealGrid, а не сам CSS
    "--pv-stagger": String(products.reveal.stagger),
    "--pv-photo-from": from.photo,
    "--pv-shadow-from": from.shadow,
  };
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
