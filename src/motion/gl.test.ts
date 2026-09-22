import { describe, expect, it } from "vitest";
import { CONTEXT_ATTRS, FULLSCREEN_TRIANGLE } from "./gl";

describe("настройки контекста WebGL", () => {
  it("холст прозрачный и premultiplied — так требует Safari на iOS", () => {
    expect(CONTEXT_ATTRS.alpha).toBe(true);
    // При false Safari на iOS всё равно считал цвет домноженным и рисовал
    // линии белыми вместо серых (см. комментарий в gl.ts)
    expect(CONTEXT_ATTRS.premultipliedAlpha).toBe(true);
  });

  it("лишнего не просим: сглаживание, глубина и трафарет выключены", () => {
    expect(CONTEXT_ATTRS.antialias).toBe(false);
    expect(CONTEXT_ATTRS.depth).toBe(false);
    expect(CONTEXT_ATTRS.stencil).toBe(false);
  });
});

describe("полноэкранный треугольник", () => {
  it("три вершины, накрывают весь экран", () => {
    expect(Array.from(FULLSCREEN_TRIANGLE)).toEqual([-1, -1, 3, -1, -1, 3]);
  });
});
