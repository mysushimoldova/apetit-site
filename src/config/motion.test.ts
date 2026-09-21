import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { motionConfigSchema } from "@/motion/config-schema";
import { motionConfig } from "./motion";

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
      scale: 900,
      width: 0.8,
      opacity: 0.45,
      speed: 0.35,
      parallax: 1.2,
      ease: 0.1,
      color: "ash",
    });
  });

  it("движок получает ровно то, что в файле", () => {
    expect(motionConfig).toEqual(raw);
  });

  it("чужие значения схему не проходят", () => {
    const bad = { background: { ...raw.background, scale: 20000 } };
    expect(motionConfigSchema.safeParse(bad).success).toBe(false);
    const extra = { background: { ...raw.background, лишнее: 1 } };
    expect(motionConfigSchema.safeParse(extra).success).toBe(false);
    const wrongMode = { background: { ...raw.background, mode: "ambient" } };
    expect(motionConfigSchema.safeParse(wrongMode).success).toBe(false);
  });
});
