// Контраст текста на четырёх фонах сайта (WCAG AA, 4.5:1).
//
// Берём цвета прямо из globals.css, чтобы проверка не разошлась с палитрой.
// Проверяем только те пары, которые на сайте действительно встречаются:
// например, ash — цвет линий фона, а не текста, и его здесь нет.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(
  path.join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

/** Значение переменной из :root — «--color-ink: #1A1714;» */
function token(name: string): string {
  const match = CSS.match(new RegExp(`--color-${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!match) throw new Error(`нет цвета --color-${name} в globals.css`);
  return match[1];
}

function luminance(hex: string): number {
  const parts = hex
    .replace("#", "")
    .match(/../g)!
    .map((pair) => {
      const c = Number.parseInt(pair, 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)];
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return Math.round(ratio * 100) / 100;
}

/** Четыре фона, на которых сайт показывает текст. */
const BACKGROUNDS = ["cream", "milk", "sand", "yellow"] as const;

/** Цвета текста и фоны, на которых они действительно встречаются. */
const TEXTS: { name: string; on: readonly (typeof BACKGROUNDS)[number][] }[] = [
  { name: "ink", on: BACKGROUNDS },
  { name: "charcoal", on: ["cream", "milk", "sand"] },
  { name: "smoke", on: ["cream", "milk", "sand"] },
];

describe("контраст текста (WCAG AA 4.5:1)", () => {
  for (const text of TEXTS) {
    for (const background of text.on) {
      it(`${text.name} на ${background}`, () => {
        const ratio = contrast(token(text.name), token(background));
        expect(ratio, `${ratio}:1`).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  // Известное расхождение: цвет ошибок формы на кремовом фоне даёт 4,24.
  // Чинится только сменой цвета в палитре — это решение архитектора,
  // вопрос вынесен в PROGRESS.md. Тест держит цифру под наблюдением: станет
  // хуже — упадёт.
  it("цвет ошибок формы: 4,24 на кремовом — ниже нормы, ждёт архитектора", () => {
    const ratio = contrast(token("closed"), token("cream"));
    expect(ratio).toBeGreaterThanOrEqual(4.24);
    expect(ratio).toBeLessThan(4.5);
  });
});
