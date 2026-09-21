// Настройки движка из src/config/motion.json — готовыми к использованию.
// JSON попадает в сборку обычным import: на клиенте это уже просто объект,
// ничего не читается и не проверяется во время работы.
//
// Проверка файла — в тесте (src/config/motion.test.ts) по схеме
// src/motion/config-schema.ts. Здесь только сужение типов: из JSON строки
// приходят как string, а движку нужны «live» | «static» и цвет из списка.
import type {
  BackgroundSettings,
  ContourColor,
  MotionConfig,
} from "@/motion/config-schema";
import raw from "./motion.json";

function asColor(value: string): ContourColor {
  return value === "smoke" || value === "sand" ? value : "ash";
}

const background: BackgroundSettings = {
  ...raw.background,
  mode: raw.background.mode === "static" ? "static" : "live",
  color: asColor(raw.background.color),
};

export const motionConfig: MotionConfig = { background };
