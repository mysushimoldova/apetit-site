import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Сторожим правила DESIGN.md 2.1 в токенах.
const css = readFileSync(
  new URL("./globals.css", import.meta.url),
  "utf-8",
).toLowerCase();

describe("дизайн-токены (globals.css) — DESIGN.md 2.1", () => {
  it("цвета: Cream #FAF7F2, Milk #FFFDFA, жёлтый и тёплый чёрный", () => {
    expect(css).toContain("--color-cream: #faf7f2");
    expect(css).toContain("--color-milk: #fffdfa");
    expect(css).toContain("--color-yellow: #ffbc0d");
    expect(css).toContain("--color-ink: #1a1714");
  });

  it("не использует чистый белый и чистый чёрный (Don't)", () => {
    expect(css).not.toMatch(/#fff(fff)?\b/);
    expect(css).not.toMatch(/#000(000)?\b/);
  });

  it("радиусов ровно четыре: 9999 / 12 / 16 / 24", () => {
    const radii = [...css.matchAll(/--radius-([a-z]+): ([^;]+);/g)].map(
      (m) => [m[1], m[2]] as const,
    );
    expect(Object.fromEntries(radii)).toEqual({
      pill: "9999px",
      input: "12px",
      tile: "16px",
      sheet: "24px",
    });
  });

  it("линии вместо теней: rule, rule-dotted, hairline", () => {
    expect(css).toContain("--rule: 1px solid var(--color-ink)");
    expect(css).toContain("--rule-dotted: 1px dotted rgba(26, 23, 20, 0.45)");
    expect(css).toContain("--hairline: 1px solid var(--color-sand)");
  });

  it("тени: только lift и «лужица» под едой", () => {
    const shadows = [...css.matchAll(/--shadow-([a-z]+):/g)].map((m) => m[1]);
    expect(shadows).toEqual(["lift"]);
    expect(css).toContain("--puddle:");
    expect(css).toContain("rgba(26, 23, 20, 0.13)");
  });

  it("токенов Background Glow больше нет", () => {
    expect(css).not.toContain("--glow-");
    expect(css).not.toContain("peach");
  });

  it("стекло по 2.1: rgba(250,247,242,.78), blur 16px saturate 130%", () => {
    expect(css).toContain("rgba(250, 247, 242, 0.78)");
    expect(css).toContain("blur(16px) saturate(130%)");
    expect(css).toContain("rgba(250, 247, 242, 0.96)");
  });

  it("шкала текста: billboard есть, category нет, caption заглавными +0.08em", () => {
    expect(css).toContain("--text-billboard: clamp(72px, 22vw, 180px)");
    expect(css).toContain("--text-billboard--line-height: 0.9");
    expect(css).not.toContain("--text-category");
    expect(css).toContain("--text-caption--letter-spacing: 0.08em");
  });

  it("размеры чипов и ценников по 2.1", () => {
    expect(css).toContain("--size-chip: 32px");
    expect(css).toContain("--text-chip: 13px");
    expect(css).toContain("--size-price-pill: 28px");
    expect(css).toContain("--text-price-tile: 15px");
    expect(css).toContain("--size-price-pill-lg: 32px");
    expect(css).toContain("--text-price: 18px");
  });
});
