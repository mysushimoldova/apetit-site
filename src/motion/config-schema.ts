// Настройки всех эффектов движка — src/config/motion.json, по разделу на
// эффект. Файл читается при сборке (обычный import) и переписывается панелью
// /dev/motion через /api/dev/motion.
//
// Схема здесь — граница доверия для этой записи (SPEC §9.4: все входные
// данные проверяются zod) и заодно проверка самого файла в тестах.
// В браузер этот модуль не попадает: клиент берёт отсюда только типы
// (import type), а они при сборке исчезают.
import { z } from "@/lib/zod";

/** Цвета линий фона (DESIGN.md → Tokens — Colors). */
export const CONTOUR_COLORS = {
  ash: "#A79E95",
  smoke: "#7A716A",
  sand: "#EAE2D5",
} as const;

export type ContourColor = keyof typeof CONTOUR_COLORS;

/** Границы ползунков панели /dev/motion. Пары [минимум, максимум, шаг]. */
export const BACKGROUND_RANGES = {
  scale: [500, 3200, 10],
  width: [0.3, 2, 0.05],
  opacity: [0.1, 1, 0.01],
  speed: [0, 1, 0.01],
  parallax: [0, 1.5, 0.05],
  ease: [0.02, 0.3, 0.01],
} as const;

const range = (key: keyof typeof BACKGROUND_RANGES) =>
  z.number().min(BACKGROUND_RANGES[key][0]).max(BACKGROUND_RANGES[key][1]);

export const backgroundSchema = z.strictObject({
  /** live — линии живут, static — один кадр без движения. */
  mode: z.enum(["live", "static"]),
  /** Масштаб рисунка: сколько пикселей на клетку узора. */
  scale: range("scale"),
  /** Толщина линии (множитель к ширине сглаживания). */
  width: range("width"),
  /** Насыщенность: прозрачность линий 0…1. */
  opacity: range("opacity"),
  /** Скорость жизни линий. */
  speed: range("speed"),
  /** Сдвиг при прокрутке: во сколько раз фон быстрее прокрутки. */
  parallax: range("parallax"),
  /** Инертность общего сглаживания прокрутки (src/motion/scroll.ts). */
  ease: range("ease"),
  color: z.enum(["ash", "smoke", "sand"]),
});

export const motionConfigSchema = z.strictObject({
  background: backgroundSchema,
});

export type BackgroundSettings = z.infer<typeof backgroundSchema>;
export type MotionConfig = z.infer<typeof motionConfigSchema>;
