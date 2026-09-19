import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Пример unit-теста: сторожим правила DESIGN.md в токенах.
const css = readFileSync(
  new URL("./globals.css", import.meta.url),
  "utf-8",
).toLowerCase();

describe("дизайн-токены (globals.css)", () => {
  it("содержит фирменный жёлтый и тёплый чёрный", () => {
    expect(css).toContain("--color-yellow: #ffbc0d");
    expect(css).toContain("--color-ink: #1a1714");
  });

  it("не использует чистый белый и чистый чёрный (DESIGN.md → Don't)", () => {
    expect(css).not.toMatch(/#fff(fff)?\b/);
    expect(css).not.toMatch(/#000(000)?\b/);
  });
});
