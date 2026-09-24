import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cubicBezier } from "@/motion/splash/easing";

// Сторожим правила DESIGN.md 2.1 в токенах.
const css = readFileSync(
  new URL("./globals.css", import.meta.url),
  "utf-8",
).toLowerCase();

describe("дизайн-токены (globals.css) — DESIGN.md 2.1", () => {
  it("цвета: Cream #F7F2EA, Milk #FFFDFA, жёлтый и тёплый чёрный", () => {
    expect(css).toContain("--color-cream: #f7f2ea");
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

  it("стекло по 2.1: rgba(247,242,234,.78), blur 16px saturate 130%", () => {
    expect(css).toContain("rgba(247, 242, 234, 0.78)");
    expect(css).toContain("blur(16px) saturate(130%)");
    expect(css).toContain("rgba(247, 242, 234, 0.96)");
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

  it("холст движка: за контентом, клики сквозь, появляется плавно", () => {
    const stage = css.slice(css.indexOf(".motion-stage {"));
    const stageRule = stage.slice(0, stage.indexOf("}"));
    expect(stageRule).toContain("position: fixed");
    expect(stageRule).toContain("z-index: -1");
    expect(stageRule).toContain("pointer-events: none");
    expect(stageRule).toContain("overflow: hidden");
    const canvas = css.slice(css.indexOf(".motion-canvas {"));
    const canvasRule = canvas.slice(0, canvas.indexOf("}"));
    // Высота — самый высокий экран телефона: при прятанье адресной строки
    // холст не меняет размер и рисунок не дёргается
    expect(canvasRule).toContain("height: 100lvh");
    expect(canvasRule).toContain("opacity: 0");
    expect(canvasRule).toContain(
      "transition: opacity var(--dur-in) var(--ease-reveal)",
    );
    expect(css).toMatch(/\.motion-canvas\[data-ready\] \{\s*opacity: 1;/);
  });

  // Закон движения (docs/MOTION.md §2–3) старше DESIGN.md: шкала длительностей
  // ровно из четырёх значений плюс шаг каскада, кривых ровно две.
  it("шкала длительностей и шаг каскада — по MOTION.md", () => {
    // Объявления в :root — до блока «уменьшить движение», у него своя шкала
    const base = css.slice(0, css.indexOf("@media (prefers-reduced-motion"));
    const durations = Object.fromEntries(
      [...base.matchAll(/--dur-([a-z]+): ([1-9]\d*)ms;/g)].map((m) => [
        m[1],
        m[2],
      ]),
    );
    expect(durations).toEqual({
      fast: "120",
      state: "200",
      in: "320",
      slow: "500",
    });
    expect(css).toContain("--stagger: 70ms");
  });

  it("кривых ровно две: вход и уход", () => {
    expect(css).toContain("--ease-out: cubic-bezier(0.32, 0.72, 0, 1)");
    expect(css).toContain("--ease-reveal: cubic-bezier(0.22, 1, 0.36, 1)");
    const curves = new Set(
      [...css.matchAll(/cubic-bezier\([^)]+\)/g)].map((m) => m[0]),
    );
    expect([...curves].sort()).toEqual([
      "cubic-bezier(0.22, 1, 0.36, 1)",
      "cubic-bezier(0.32, 0.72, 0, 1)",
    ]);
  });

  // Сторож против кривой с медленным стартом (решение архитектора
  // 24.09.2026): и вход, и уход обязаны трогаться сразу, иначе движение
  // читается как залипание. Прежняя cubic-bezier(.4, 0, .2, 1) давала за
  // первые 10 % времени около 5 % пути и под этот порог не проходит.
  it("обе кривые из стилей за первые 10 % времени проходят не меньше 25 % пути", () => {
    const curves = [...css.matchAll(/cubic-bezier\(([^)]+)\)/g)].map((m) =>
      m[1].split(",").map((n) => Number(n.trim())),
    );
    expect(curves.length).toBeGreaterThan(0);
    for (const [x1, y1, x2, y2] of curves) {
      const value = cubicBezier(x1, y1, x2, y2)(0.1);
      expect(
        value,
        `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`,
      ).toBeGreaterThanOrEqual(0.25);
    }
  });

  // «Уменьшить движение» — равноценная версия, а не выключенная
  // (docs/MOTION.md §6, решение архитектора 24.09.2026): 180 мс и только
  // прозрачность. Раньше здесь стояли нули и всё менялось рывком.
  it("при «уменьшить движение» длительности 180 мс, каскада нет", () => {
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion"));
    const rule = block.slice(0, block.indexOf("}"));
    for (const name of [
      "--dur-fast",
      "--dur-state",
      "--dur-in",
      "--dur-slow",
    ]) {
      expect(rule, name).toContain(name + ": 180ms");
    }
    expect(rule).toContain("--stagger: 0ms");
  });

  it("при «уменьшить движение» ничто не двигается: сдвиги сняты везде", () => {
    // Последний блок файла — тот, что снимает движение
    const block = css.slice(css.lastIndexOf("@media (prefers-reduced-motion"));
    for (const selector of [
      ".btn-primary:active",
      ".add-button:active",
      ".icon-button:active",
      ".segment:active",
      ".tile-cart-minus:active",
      ".tile-cart-extra",
      ".sheet-panel",
      ".cart-bar",
      ".header-cart",
      ".confirm-check",
    ]) {
      expect(block, selector).toContain(selector);
    }
    // Ни одного сдвига или поджатия не осталось
    expect(block).not.toMatch(/transform:\s*(scale|translatey|translatex)\(/);
    expect(block).toContain("animation-name: confirm-fade");
  });

  it("старого растрового фона в стилях не осталось", () => {
    expect(css).not.toContain("brand-bg");
    expect(css).not.toContain("linii.webp");
    expect(css).not.toContain("--bg-frame-w");
  });
});
