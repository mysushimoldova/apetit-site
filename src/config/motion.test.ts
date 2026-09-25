import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONTOUR_COLORS,
  motionConfigSchema,
  PAGE_BACKGROUNDS,
} from "@/motion/config-schema";
import {
  asColor,
  asPageBackground,
  asRevealType,
  asSplashExit,
  motionConfig,
  pageBackground,
  productsConfig,
  splashConfig,
} from "./motion";

const raw = JSON.parse(
  readFileSync(new URL("./motion.json", import.meta.url), "utf8"),
);

describe("src/config/motion.json", () => {
  it("проходит схему: значения в границах, лишних полей нет", () => {
    const parsed = motionConfigSchema.safeParse(raw);
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });

  // Числа ползунков (плотность, толщина, насыщенность, скорость, сдвиг,
  // инертность) Амян подбирает сам в панели /dev/motion и сохраняет прямо в
  // этот файл — пришпиливать их к тесту нельзя, иначе каждая его правка
  // роняет сборку. Границы и так проверяет схема (тест выше). Здесь сторожим
  // то, что выбирается не на глаз: набор полей и решения архитектора —
  // режим «живые линии» и цвет линий Ash.
  it("набор настроек фона тот же, режим и цвет линий — как решил архитектор", () => {
    expect(Object.keys(raw.background).sort()).toEqual([
      "color",
      "ease",
      "mode",
      "opacity",
      "parallax",
      "speed",
      "tilesAcross",
      "width",
    ]);
    expect(raw.background.mode).toBe("live");
    expect(raw.background.color).toBe("ash");
  });

  // Карточки блюд: тень, появление, подъём при прокрутке (задача 14).
  // Числа Амян тоже подбирает в панели, поэтому сторожим набор полей и то,
  // что решено архитектором: эффект включён, появление — «выезжает».
  it("набор настроек карточек тот же", () => {
    expect(Object.keys(raw.products).sort()).toEqual([
      "lift",
      "reveal",
      "shadow",
    ]);
    expect(Object.keys(raw.products.shadow).sort()).toEqual([
      "aa",
      "ab",
      "ah",
      "aw",
      "ca",
      "cb",
      "ch",
      "cw",
      "tint",
      "y",
    ]);
    expect(Object.keys(raw.products.reveal).sort()).toEqual([
      "dist",
      "dur",
      "shadowDelay",
      "stagger",
      "type",
    ]);
    expect(Object.keys(raw.products.lift).sort()).toEqual([
      "amt",
      "enabled",
      "grow",
      "rise",
      "sensitivity",
      "settle",
      "shadowReact",
      "smooth",
      "tilt",
    ]);
    expect(raw.products.reveal.type).toBe("lift");
    expect(raw.products.lift.enabled).toBe(true);
    expect(productsConfig).toEqual(raw.products);
  });

  // Заставка категории. Числа хозяин подбирает в панели, поэтому сторожим
  // набор полей и решения: одно блюдо на категорию (ни count, ни смены
  // блюд в настройках больше нет) и уход затуханием. warmMax — сколько
  // роликов держать тёплыми (решение архитектора 25.09.2026).
  it("набор настроек заставки тот же", () => {
    expect(Object.keys(raw.splash).sort()).toEqual([
      "disc",
      "dish",
      "enabled",
      "exit",
      "fin",
      "fout",
      "hold",
      "lines",
      "skip",
      "warmMax",
      "wordTop",
      "wordY",
    ]);
    expect(Object.keys(raw.splash.dish).sort()).toEqual([
      "soft",
      "start",
      "y0",
      "y1",
      "z0",
      "z1",
    ]);
    expect(Object.keys(raw.splash.disc).sort()).toEqual([
      "d0",
      "d1",
      "delay",
      "dsoft",
      "dstart",
      "y",
    ]);
    expect(raw.splash.enabled).toBe(true);
    expect(raw.splash.exit).toBe("fade");
    expect(splashConfig).toEqual(raw.splash);
  });

  it("уход заставки — один из трёх", () => {
    for (const exit of ["fade", "lift", "zoom"]) {
      expect(asSplashExit(exit)).toBe(exit);
    }
    expect(asSplashExit("кувырком")).toBe("fade");
  });

  it("настройки заставки вне границ схему не проходят", () => {
    const bad = {
      ...raw,
      splash: { ...raw.splash, dish: { ...raw.splash.dish, z0: 9 } },
    };
    expect(motionConfigSchema.safeParse(bad).success).toBe(false);
    const extra = {
      ...raw,
      splash: { ...raw.splash, count: 2 },
    };
    expect(motionConfigSchema.safeParse(extra).success).toBe(false);
    const noDisc = { ...raw, splash: { ...raw.splash, disc: undefined } };
    expect(motionConfigSchema.safeParse(noDisc).success).toBe(false);
  });

  it("вид появления — один из трёх", () => {
    for (const type of ["lift", "scale", "none"]) {
      expect(asRevealType(type)).toBe(type);
    }
    expect(asRevealType("кувырком")).toBe("lift");
  });

  it("настройки карточек вне границ схему не проходят", () => {
    const badBlur = {
      ...raw,
      products: {
        ...raw.products,
        shadow: { ...raw.products.shadow, ab: 999 },
      },
    };
    expect(motionConfigSchema.safeParse(badBlur).success).toBe(false);
    const badType = {
      ...raw,
      products: {
        ...raw.products,
        reveal: { ...raw.products.reveal, type: "кувырок" },
      },
    };
    expect(motionConfigSchema.safeParse(badType).success).toBe(false);
    const noProducts = { background: raw.background, page: raw.page };
    expect(motionConfigSchema.safeParse(noProducts).success).toBe(false);
  });

  it("цвет фона страницы — один из четырёх вариантов", () => {
    expect(Object.keys(raw.page)).toEqual(["background"]);
    expect(Object.keys(PAGE_BACKGROUNDS)).toContain(raw.page.background);
    expect(pageBackground).toBe(raw.page.background);
  });

  // Цвета перечислены дважды: в схеме (там zod, в браузер не уезжает) и в
  // motion.ts. Разойдутся — новое значение молча превратится в значение по
  // умолчанию, и Амян не поймёт, почему панель «не сохраняет» цвет.
  it("оба списка цветов — те же, что в схеме", () => {
    for (const color of Object.keys(CONTOUR_COLORS)) {
      expect(asColor(color)).toBe(color);
    }
    for (const background of Object.keys(PAGE_BACKGROUNDS)) {
      expect(asPageBackground(background)).toBe(background);
    }
  });

  it("движок получает ровно то, что в файле", () => {
    expect(motionConfig).toEqual(raw);
  });

  it("чужие значения схему не проходят", () => {
    const bad = { ...raw, background: { ...raw.background, tilesAcross: 20 } };
    expect(motionConfigSchema.safeParse(bad).success).toBe(false);
    const extra = { ...raw, background: { ...raw.background, лишнее: 1 } };
    expect(motionConfigSchema.safeParse(extra).success).toBe(false);
    const wrongMode = {
      ...raw,
      background: { ...raw.background, mode: "ambient" },
    };
    expect(motionConfigSchema.safeParse(wrongMode).success).toBe(false);
    const wrongColor = { ...raw, page: { background: "#FFFFFF" } };
    expect(motionConfigSchema.safeParse(wrongColor).success).toBe(false);
    const noPage = { background: raw.background };
    expect(motionConfigSchema.safeParse(noPage).success).toBe(false);
  });
});
