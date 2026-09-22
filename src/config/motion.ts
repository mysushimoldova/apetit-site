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

const background: BackgroundSettings = {
  ...raw.background,
  mode: raw.background.mode === "static" ? "static" : "live",
  color: asColor(raw.background.color),
};

const page: PageSettings = {
  background: asPageBackground(raw.page.background),
};

export const motionConfig: MotionConfig = { background, page };

/** Цвет фона страницы — отдельно: его берут корневые layout и <meta
 *  name="theme-color"> (src/routes/root.tsx). */
export const pageBackground = page.background;
