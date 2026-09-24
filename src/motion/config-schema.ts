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
  width: [0.2, 3, 0.02],
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
  /** Полутолщина линии в пикселях CSS: 0.38 — волосяная линия, 1 — линия
   *  толщиной примерно в два пикселя. Края всегда мягкие (±0.6 px), поэтому
   *  линия не рассыпается в пунктир даже на самом тонком значении. */
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

/** Границы ползунков вкладки «Ecran categorie». Значения и шаги — как в
 *  эталоне docs/motion/splash-demo.html (панель слева). */
export const SPLASH_RANGES = {
  hold: [300, 3500, 50],
  fade: [120, 700, 20],
  zoom: [0.45, 1, 0.02],
  wordY: [-220, 220, 5],
  disc: [0, 1.1, 0.02],
  lines: [0, 0.6, 0.02],
  count: [1, 2, 1],
  xfade: [60, 500, 20],
} as const;

const splashRange = (key: keyof typeof SPLASH_RANGES) =>
  z.number().min(SPLASH_RANGES[key][0]).max(SPLASH_RANGES[key][1]);

/** Границы ползунка вкладки «Ecran categorie» для фото-заставки. */
export const SPLASH_PHOTO_RANGES = {
  zoomFrom: [1, 1.2, 0.01],
} as const;

/** Заставка из фото — для категорий без ролика. Фото не вращается (это
 *  картинка, а не съёмка), поэтому движение у него своё: за время показа
 *  оно съезжается с zoomFrom до 1 и чуть поднимается. */
export const splashPhotoSchema = z.strictObject({
  /** Начальный масштаб фото: 1.06 — чуть крупнее, чем встанет в конце. */
  zoomFrom: z
    .number()
    .min(SPLASH_PHOTO_RANGES.zoomFrom[0])
    .max(SPLASH_PHOTO_RANGES.zoomFrom[1]),
});

/** Заставка категории (docs/motion/splash-prompt.md). Все числа берутся
 *  отсюда: в коде заставки нет ни одного своего значения. */
export const splashSchema = z.strictObject({
  enabled: z.boolean(),
  /** Сколько заставка держится до ухода, мс (уход считается от неё). */
  hold: splashRange("hold"),
  /** Появление круга, блюда и слова, мс. */
  fade: splashRange("fade"),
  /** Размер блюда: доля ширины экрана. */
  zoom: splashRange("zoom"),
  /** Слово категории выше (−) или ниже (+) середины, px. */
  wordY: splashRange("wordY"),
  /** Слово поверх блюда или под ним. */
  wordTop: z.boolean(),
  /** Показывать слово категории вообще. */
  word: z.boolean(),
  /** Диаметр жёлтого круга: доля ширины экрана. 0 — круга нет. */
  disc: splashRange("disc"),
  /** Насыщенность линий фона на заставке. */
  lines: splashRange("lines"),
  /** Сколько блюд показать подряд: 1 или 2. */
  count: splashRange("count"),
  /** Смена блюда, мс (когда их два). */
  xfade: splashRange("xfade"),
  /** Как заставка уходит: шторкой вверх, затуханием или в меню. */
  exit: z.enum(["lift", "fade", "zoom"]),
  /** Можно прервать касанием. */
  skip: z.boolean(),
  /** Заставка из фото — категории без ролика. */
  photo: splashPhotoSchema,
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
  splash: splashSchema,
  page: pageSchema,
});

export type BackgroundSettings = z.infer<typeof backgroundSchema>;
export type ProductShadowSettings = z.infer<typeof productShadowSchema>;
export type ProductRevealSettings = z.infer<typeof productRevealSchema>;
export type ProductLiftSettings = z.infer<typeof productLiftSchema>;
export type ProductsSettings = z.infer<typeof productsSchema>;
export type SplashPhotoSettings = z.infer<typeof splashPhotoSchema>;
export type SplashSettings = z.infer<typeof splashSchema>;
export type PageSettings = z.infer<typeof pageSchema>;
export type MotionConfig = z.infer<typeof motionConfigSchema>;
