import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { motionConfigSchema } from "@/motion/config-schema";
import { motionConfig, pageBackground } from "./motion";

const raw = JSON.parse(
  readFileSync(new URL("./motion.json", import.meta.url), "utf8"),
);

describe("src/config/motion.json", () => {
  it("проходит схему: значения в границах, лишних полей нет", () => {
    const parsed = motionConfigSchema.safeParse(raw);
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });

  it("значения фона — те, что задал архитектор", () => {
    expect(raw.background).toEqual({
      mode: "live",
      // 1900 px экрана / прежний масштаб 900 px на клетку = 2.11:
      // вид на компьютере остался прежним (задача 09)
      tilesAcross: 2.11,
      width: 0.8,
      opacity: 0.45,
      speed: 0.35,
      parallax: 1.2,
      ease: 0.1,
      color: "ash",
    });
  });

  it("цвет фона страницы — один из четырёх вариантов", () => {
    expect(raw.page).toEqual({ background: "#F7F2EA" });
    expect(pageBackground).toBe(raw.page.background);
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
