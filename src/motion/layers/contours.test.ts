import { describe, expect, it } from "vitest";
import type { BackgroundSettings } from "../config-schema";
import type { Frame } from "../types";
import {
  contoursUniforms,
  FRAGMENT_100,
  FRAGMENT_300,
  VERTEX_100,
  VERTEX_300,
} from "./contours";

const settings: BackgroundSettings = {
  mode: "live",
  scale: 900,
  width: 0.8,
  opacity: 0.45,
  speed: 0.35,
  parallax: 1.2,
  ease: 0.1,
  color: "ash",
};

const frame: Frame = {
  t: 2,
  dt: 16,
  width: 390,
  height: 844,
  dpr: 2,
  scroll: 500,
};

describe("юниформы слоя фона", () => {
  it("масштаб и сдвиг считаются в пикселях холста (× dpr)", () => {
    const u = contoursUniforms(settings, frame);
    expect(u.t).toBe(2);
    expect(u.scale).toBe(1800);
    expect(u.width).toBe(0.8);
    expect(u.opacity).toBe(0.45);
    expect(u.speed).toBe(0.35);
    // Прокрутка вниз — линии уезжают: 500 × 1.2 × 2
    expect(u.offY).toBe(-1200);
  });

  it("«не двигается» — время и сдвиг нулевые", () => {
    const u = contoursUniforms({ ...settings, mode: "static" }, frame);
    expect(u.t).toBe(0);
    expect(u.offY).toBe(0);
    expect(u.scale).toBe(1800);
  });

  it("цвета — Ash, Smoke, Sand в долях единицы", () => {
    expect(contoursUniforms(settings, frame).rgb).toEqual([
      0xa7 / 255,
      0x9e / 255,
      0x95 / 255,
    ]);
    expect(
      contoursUniforms({ ...settings, color: "smoke" }, frame).rgb,
    ).toEqual([0x7a / 255, 0x71 / 255, 0x6a / 255]);
    expect(contoursUniforms({ ...settings, color: "sand" }, frame).rgb).toEqual(
      [0xea / 255, 0xe2 / 255, 0xd5 / 255],
    );
  });
});

describe("шейдеры: WebGL2 и запасной WebGL1", () => {
  it("формула в обоих одна и та же", () => {
    const formula = "v += W(p, 1.,0.,0.7,0.30,0.95);";
    expect(FRAGMENT_300).toContain(formula);
    expect(FRAGMENT_100).toContain(formula);
    const line = "float line = 1.0 - smoothstep(0.0, uW * w, g);";
    expect(FRAGMENT_300).toContain(line);
    expect(FRAGMENT_100).toContain(line);
    // Десять волн — ровно столько, сколько в задании
    const count = (source: string) => source.split("v += W(p,").length - 1;
    expect(count(FRAGMENT_300)).toBe(10);
    expect(count(FRAGMENT_100)).toBe(10);
  });

  it("одинаковые юниформы под одинаковыми именами", () => {
    for (const source of [FRAGMENT_300, FRAGMENT_100]) {
      expect(source).toContain("uniform float uT, uScale, uW, uA, uSpeed;");
      expect(source).toContain("uniform vec2 uOff;");
      expect(source).toContain("uniform vec3 uC;");
    }
  });

  it("WebGL2 — версия 300 es, WebGL1 — расширение для fwidth", () => {
    expect(VERTEX_300.startsWith("#version 300 es")).toBe(true);
    expect(FRAGMENT_300.startsWith("#version 300 es")).toBe(true);
    expect(FRAGMENT_300).toContain("out vec4 o;");
    expect(VERTEX_100).toContain("attribute vec2 p;");
    expect(
      FRAGMENT_100.startsWith("#extension GL_OES_standard_derivatives"),
    ).toBe(true);
    expect(FRAGMENT_100).toContain("gl_FragColor");
    expect(FRAGMENT_100).not.toContain("#version");
  });
});
