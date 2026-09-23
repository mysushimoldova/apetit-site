// Настройки движка из src/config/motion.json — готовыми к использованию.
// JSON попадает в сборку обычным import: на клиенте это уже просто объект,
// ничего не читается и не проверяется во время работы.
//
// Проверка файла — в тесте (src/config/motion.test.ts) по схеме
// src/motion/config-schema.ts. Здесь только сужение типов: из JSON строки
// приходят как string, а движку нужны «live» | «static», цвет линий и цвет
// фона страницы из списков.
import type {
  BackgroundSettings,
  ContourColor,
  MotionConfig,
  PageBackground,
  PageSettings,
  ProductRevealSettings,
  ProductsSettings,
} from "@/motion/config-schema";
import raw from "./motion.json";

// Списки здесь повторены значениями, а не взяты из схемы: config-schema.ts
// тянет за собой zod, а этот модуль попадает в браузер. Чтобы повтор не
// разошёлся молча, тест (motion.test.ts) прогоняет через обе функции все
// значения из схемы и ждёт их обратно.
export function asColor(value: string): ContourColor {
  return value === "smoke" || value === "sand" ? value : "ash";
}

export function asPageBackground(value: string): PageBackground {
  return value === "#FAF7F2" || value === "#F4EDE2" || value === "#F1E9DB"
    ? value
    : "#F7F2EA";
}

export function asRevealType(value: string): ProductRevealSettings["type"] {
  return value === "scale" || value === "none" ? value : "lift";
}

const background: BackgroundSettings = {
  ...raw.background,
  mode: raw.background.mode === "static" ? "static" : "live",
  color: asColor(raw.background.color),
};

const products: ProductsSettings = {
  ...raw.products,
  reveal: {
    ...raw.products.reveal,
    type: asRevealType(raw.products.reveal.type),
  },
};

const page: PageSettings = {
  background: asPageBackground(raw.page.background),
};

export const motionConfig: MotionConfig = { background, products, page };

/** Настройки карточек блюд — тень, появление, подъём при прокрутке. */
export const productsConfig = products;

/** Цвет фона страницы — отдельно: его берут корневые layout и <meta
 *  name="theme-color"> (src/routes/root.tsx). */
export const pageBackground = page.background;
