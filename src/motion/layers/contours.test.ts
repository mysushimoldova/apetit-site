import { describe, expect, it } from "vitest";
import type { BackgroundSettings } from "../config-schema";
import type { Frame } from "../types";
import {
  contoursUniforms,
  fieldSource,
  fragment100,
  fragment300,
  MAX_WAVES,
  VERTEX_100,
  VERTEX_300,
} from "./contours";

const FRAGMENT_300 = fragment300(MAX_WAVES);
const FRAGMENT_100 = fragment100(MAX_WAVES);

const settings: BackgroundSettings = {
  mode: "live",
  tilesAcross: 2.11,
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
  scrollY: 500,
  quality: 1,
};

describe("юниформы слоя фона", () => {
  it("масштаб — ширина холста в пикселях экрана, делённая на плотность", () => {
    const u = contoursUniforms(settings, frame);
    expect(u.t).toBe(2);
    // 390 CSS × 2 = 780 пикселей экрана; 780 / 2.11 ≈ 369.7
    expect(u.scale).toBeCloseTo(780 / 2.11, 6);
    // Толщина в настройках — в пикселях CSS, шейдер считает в пикселях холста
    expect(u.width).toBeCloseTo(1.6, 6);
    expect(u.opacity).toBe(0.45);
    expect(u.speed).toBe(0.35);
    // Прокрутка вниз — линии уезжают: 500 × 1.2 × 2
    expect(u.offY).toBe(-1200);
  });

  it("«не двигается» — стоит время линий, сдвиг при прокрутке работает", () => {
    const u = contoursUniforms({ ...settings, mode: "static" }, frame);
    expect(u.t).toBe(0);
    expect(u.offY).toBe(-1200);
    expect(u.scale).toBeCloseTo(780 / 2.11, 6);
  });

  it("рисунок укладывается ровно tilesAcross раз по ширине — на любом экране", () => {
    const phone = contoursUniforms(settings, frame);
    const desktop = contoursUniforms(settings, {
      ...frame,
      width: 1900,
      dpr: 1,
    });
    // Клеток по ширине холста — одинаково: в этом весь смысл tilesAcross
    expect((frame.width * frame.dpr) / phone.scale).toBeCloseTo(2.11, 6);
    expect(1900 / desktop.scale).toBeCloseTo(2.11, 6);
  });

  it("плотность вдвое больше — клетка вдвое мельче", () => {
    const dense = contoursUniforms({ ...settings, tilesAcross: 4.22 }, frame);
    const normal = contoursUniforms(settings, frame);
    expect(dense.scale).toBeCloseTo(normal.scale / 2, 6);
  });

  it("цвета — Ash, Smoke, Sand в долях единицы", () => {
    expect(contoursUniforms(settings, frame).rgb).toEqual([
      0xa7 / 255,
      0x9e / 255,
      0x95 / 255,
    ]);
    expect(
      contoursUniforms({ ...settings, color: "smoke" }, frame).rgb,
    ).toEqual([0x6b / 255, 0x62 / 255, 0x5b / 255]);
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
    const line = "float line = 1.0 - smoothstep(uW - 0.6, uW + 0.6, d);";
    expect(FRAGMENT_300).toContain(line);
    expect(FRAGMENT_100).toContain(line);
    // Десять волн — ровно столько, сколько в задании
    const count = (source: string) => source.split("v += W(p,").length - 1;
    expect(count(FRAGMENT_300)).toBe(10);
    expect(count(FRAGMENT_100)).toBe(10);
  });

  it("толщина — расстояние в пикселях экрана, а не доля от крутизны поля", () => {
    for (const source of [FRAGMENT_300, FRAGMENT_100]) {
      // Расстояние до линии в пикселях: g, делённое на длину градиента
      expect(source).toContain(
        "float d = g / max(length(vec2(dFdx(v), dFdy(v))), 1e-5);",
      );
      // Старого вида, из-за которого линия схлопывалась на пологих местах,
      // остаться не должно
      expect(source).not.toContain("fwidth");
      expect(source).not.toContain("uW * w");
    }
  });

  it("уровень качества убавляет волны, а не разрешение", () => {
    const count = (source: string) => source.split("v += W(p,").length - 1;
    expect(count(fieldSource(10))).toBe(10);
    expect(count(fieldSource(6))).toBe(6);
    expect(count(fieldSource(4))).toBe(4);
    // Первой всегда остаётся самая крупная волна
    expect(fieldSource(4)).toContain("v += W(p, 1.,0.,0.7,0.30,0.95);");
    expect(fieldSource(4)).not.toContain("v += W(p, -3.,1.,1.8,-0.26,0.13);");
    // Странные числа не ломают сборку шейдера
    expect(count(fieldSource(0))).toBe(1);
    expect(count(fieldSource(99))).toBe(MAX_WAVES);
  });

  it("на слабом уровне слой просит меньше волн", () => {
    expect(contoursUniforms(settings, frame).waves).toBe(10);
    expect(contoursUniforms(settings, { ...frame, quality: 2 }).waves).toBe(6);
    expect(contoursUniforms(settings, { ...frame, quality: 3 }).waves).toBe(4);
  });

  it("цвет домножен на альфу — иначе Safari на iOS рисует линии белыми", () => {
    for (const source of [FRAGMENT_300, FRAGMENT_100]) {
      expect(source).toContain("float a = line * uA;");
      expect(source).toContain("vec4(uC * a, a)");
      // Недомноженного вида остаться не должно
      expect(source).not.toContain("vec4(uC, line * uA)");
    }
  });

  it("одинаковые юниформы под одинаковыми именами", () => {
    for (const source of [FRAGMENT_300, FRAGMENT_100]) {
      expect(source).toContain("uniform float uT, uScale, uW, uA, uSpeed;");
      expect(source).toContain("uniform vec2 uOff;");
      expect(source).toContain("uniform vec3 uC;");
    }
  });

  it("WebGL2 — версия 300 es, WebGL1 — расширение для производных", () => {
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
