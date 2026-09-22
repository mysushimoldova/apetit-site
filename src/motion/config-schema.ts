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
  smoke: "#6B625B",
  sand: "#EAE2D5",
} as const;

export type ContourColor = keyof typeof CONTOUR_COLORS;

/** Варианты цвета фона страницы — выбирает Амян в панели /dev/motion.
 *  A — как было с самого начала, дальше теплее и темнее. */
export const PAGE_BACKGROUNDS = {
  "#FAF7F2": "A",
  "#F7F2EA": "B",
  "#F4EDE2": "C",
  "#F1E9DB": "D",
} as const;

export type PageBackground = keyof typeof PAGE_BACKGROUNDS;

/** Границы ползунков панели /dev/motion. Пары [минимум, максимум, шаг]. */
export const BACKGROUND_RANGES = {
  tilesAcross: [0.8, 6, 0.1],
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
  /** Плотность рисунка: сколько раз он укладывается по ширине экрана.
   *  Не в пикселях — иначе на телефоне видно меньше половины оборота,
   *  а на компьютере два (задача 09). */
  tilesAcross: range("tilesAcross"),
  /** Толщина линии (множитель к ширине сглаживания), пиксели экрана. */
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

export const pageSchema = z.strictObject({
  /** Цвет фона всех страниц; от него же берут цвет стеклянные поверхности. */
  background: z.enum(
    Object.keys(PAGE_BACKGROUNDS) as [PageBackground, ...PageBackground[]],
  ),
});

export const motionConfigSchema = z.strictObject({
  background: backgroundSchema,
  page: pageSchema,
});

export type BackgroundSettings = z.infer<typeof backgroundSchema>;
export type PageSettings = z.infer<typeof pageSchema>;
export type MotionConfig = z.infer<typeof motionConfigSchema>;
