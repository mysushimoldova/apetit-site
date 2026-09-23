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

/** Границы ползунков вкладки «Produse». Значения и шаги — как в демо
 *  docs/motion/produse-demo.html (панель внизу файла). */
export const PRODUCTS_RANGES = {
  // Тень: «mare» — широкая мягкая (ambient), «mică» — контактная (contact)
  aw: [30, 120, 1],
  ah: [4, 48, 1],
  ab: [0, 48, 1],
  aa: [0, 0.6, 0.01],
  cw: [0, 90, 1],
  ch: [2, 28, 1],
  cb: [0, 24, 1],
  ca: [0, 0.7, 0.01],
  y: [-24, 30, 1],
  tint: [0, 1, 0.05],
  // Появление
  dur: [120, 800, 10],
  dist: [0, 40, 1],
  stagger: [0, 200, 5],
  shadowDelay: [0, 400, 10],
  // Подъём при прокрутке
  amt: [0, 2, 0.05],
  smooth: [0.03, 0.3, 0.01],
  shadowReact: [0, 2, 0.05],
  rise: [2, 18, 1],
  sensitivity: [4, 40, 1],
  settle: [20, 240, 5],
  grow: [0, 4, 0.1],
  tilt: [0, 3, 0.1],
} as const;

const productRange = (key: keyof typeof PRODUCTS_RANGES) =>
  z.number().min(PRODUCTS_RANGES[key][0]).max(PRODUCTS_RANGES[key][1]);

/** Тень под фото блюда: два слоя, оба — эллипс под низом блока фото.
 *  Ширина в процентах от блока, высота и размытие в пикселях. */
export const productShadowSchema = z.strictObject({
  /** Широкая мягкая тень: ширина %, высота px, размытие px, прозрачность. */
  aw: productRange("aw"),
  ah: productRange("ah"),
  ab: productRange("ab"),
  aa: productRange("aa"),
  /** Контактная тень — та же четвёрка, но меньше и темнее. */
  cw: productRange("cw"),
  ch: productRange("ch"),
  cb: productRange("cb"),
  ca: productRange("ca"),
  /** Низ тени: на сколько пикселей выше низа блока фото. */
  y: productRange("y"),
  /** Теплота цвета: 0 — тёплый чёрный #1A1714, 1 — рыжий rgb(92,52,22). */
  tint: productRange("tint"),
});

export const productRevealSchema = z.strictObject({
  /** lift — фото выезжает снизу, scale — подрастает, none — только проявление. */
  type: z.enum(["lift", "scale", "none"]),
  dur: productRange("dur"),
  /** Насколько ниже начинает фото при type: "lift", px. */
  dist: productRange("dist"),
  /** Задержка между колонками слева направо, мс. */
  stagger: productRange("stagger"),
  /** Насколько тень отстаёт от фото, мс. */
  shadowDelay: productRange("shadowDelay"),
});

export const productLiftSchema = z.strictObject({
  enabled: z.boolean(),
  /** Общая интенсивность подъёма. */
  amt: productRange("amt"),
  /** Инертность своего сглаживания прокрутки (слой считает скорость сам). */
  smooth: productRange("smooth"),
  /** Насколько сильно на подъём отзывается тень. */
  shadowReact: productRange("shadowReact"),
  /** На сколько пикселей фото поднимается на полном ходу. */
  rise: productRange("rise"),
  /** При какой скорости (px/кадр) подъём почти полный. */
  sensitivity: productRange("sensitivity"),
  /** Жёсткость пружины на приземлении: меньше — дольше опускается. */
  settle: productRange("settle"),
  /** На сколько процентов фото подрастает на полном ходу. */
  grow: productRange("grow"),
  /** Наклон фото по ходу движения, градусы. */
  tilt: productRange("tilt"),
});

export const productsSchema = z.strictObject({
  shadow: productShadowSchema,
  reveal: productRevealSchema,
  lift: productLiftSchema,
});

export const pageSchema = z.strictObject({
  /** Цвет фона всех страниц; от него же берут цвет стеклянные поверхности. */
  background: z.enum(
    Object.keys(PAGE_BACKGROUNDS) as [PageBackground, ...PageBackground[]],
  ),
});

export const motionConfigSchema = z.strictObject({
  background: backgroundSchema,
  products: productsSchema,
  page: pageSchema,
});

export type BackgroundSettings = z.infer<typeof backgroundSchema>;
export type ProductShadowSettings = z.infer<typeof productShadowSchema>;
export type ProductRevealSettings = z.infer<typeof productRevealSchema>;
export type ProductLiftSettings = z.infer<typeof productLiftSchema>;
export type ProductsSettings = z.infer<typeof productsSchema>;
export type PageSettings = z.infer<typeof pageSchema>;
export type MotionConfig = z.infer<typeof motionConfigSchema>;
