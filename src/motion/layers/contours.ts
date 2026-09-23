// Слой живого фона: фирменные контурные линии (DESIGN.md → Background).
//
// Поле складывается из волн с разными направлениями, фазами и скоростями;
// линии — это его «горизонтали» (уровни). Толщина линии считается в пикселях
// экрана, поэтому она одинаковая и там, где поле пологое, и там, где крутое.
// Формула проверена на макете и не меняется: правки — только через настройки
// в src/config/motion.json и панель /dev/motion.
import type { BackgroundSettings, ContourColor } from "../config-schema";
import { createFullscreenTriangle, createProgram, isGL2 } from "../gl";
import { WAVES_BY_QUALITY } from "../quality";
import type { Frame, GL, Layer } from "../types";

/** Цвета линий в шейдере — те же, что CONTOUR_COLORS в config-schema.ts
 *  (там zod, он в браузер не идёт; здесь — только числа). */
const RGB: Record<ContourColor, [number, number, number]> = {
  ash: [0xa7 / 255, 0x9e / 255, 0x95 / 255],
  smoke: [0x6b / 255, 0x62 / 255, 0x5b / 255],
  sand: [0xea / 255, 0xe2 / 255, 0xd5 / 255],
};

/** Волны поля по убыванию вклада: первые — крупные и сильные, последние
 *  дорисовывают мелочь. На слабом телефоне берутся только первые
 *  (WAVES_BY_QUALITY в src/motion/quality.ts): так рисунок упрощается, а
 *  холст остаётся во всё разрешение экрана — уменьшать его нельзя, линии
 *  от этого сразу мылятся. */
export const WAVE_LINES = [
  "  v += W(p, 1.,0.,0.7,0.30,0.95);",
  "  v += W(p, 0.,1.,2.1,-0.22,0.80);",
  "  v += W(p, 1.,1.,4.0,0.17,0.55);",
  "  v += W(p, 2.,-1.,1.2,-0.31,0.40);",
  "  v += W(p, -1.,2.,5.4,0.24,0.36);",
  "  v += W(p, 2.,2.,3.3,-0.14,0.26);",
  "  v += W(p, 3.,-1.,0.4,0.27,0.20);",
  "  v += W(p, -2.,3.,2.7,-0.19,0.18);",
  "  v += W(p, 3.,2.,5.9,0.12,0.14);",
  "  v += W(p, -3.,1.,1.8,-0.26,0.13);",
] as const;

export const MAX_WAVES = WAVE_LINES.length;

/** Поле волн: столько слагаемых, сколько просит уровень качества. */
export function fieldSource(waves: number): string {
  const used = WAVE_LINES.slice(0, Math.max(1, Math.min(MAX_WAVES, waves)));
  return `
float W(vec2 p, float nx, float ny, float ph, float sp, float a){
  return a * sin(6.2831853 * (nx*p.x + ny*p.y) + ph + uT*sp*uSpeed);
}
float field(vec2 p){
  float v = 0.;
${used.join("\n")}
  return v;
}`;
}

/**
 * Общая часть main(): из поля — одна линия с мягкими краями.
 *
 * g — расстояние до ближайшего уровня в единицах поля, а
 * length(vec2(dFdx(v), dFdy(v))) — насколько поле меняется на одном пикселе
 * экрана. Их частное d и есть расстояние до середины линии В ПИКСЕЛЯХ, одно
 * и то же на пологом и на крутом участке. uW — полутолщина линии в пикселях;
 * ±0.6 px по краям — мягкий край, он же не даёт тонкой линии проваливаться
 * между пикселями и рассыпаться в пунктир.
 *
 * Делитель прижат снизу к 1e-5: на идеально ровном участке поле не меняется
 * вовсе, и без этого было бы деление на ноль.
 */
const LINE = `
  vec2 p = (gl_FragCoord.xy + uOff) / uScale;
  float v = field(p) * 3.2;
  float g = abs(fract(v) - 0.5);
  float d = g / max(length(vec2(dFdx(v), dFdy(v))), 1e-5);
  float line = 1.0 - smoothstep(uW - 0.6, uW + 0.6, d);`;

/** Альфа линии и цвет, домноженный на неё (premultiplied alpha).
 *  Так требует Safari на iOS: он складывает холст со страницей только
 *  этим способом, иначе линии выходят белыми вместо серых.
 *  Подробности — в комментарии к CONTEXT_ATTRS в src/motion/gl.ts. */
const PREMULTIPLIED = `float a = line * uA;`;

const UNIFORMS = `
uniform float uT, uScale, uW, uA, uSpeed;
uniform vec2 uOff;
uniform vec3 uC;`;

/** WebGL2 (GLSL ES 3.00). */
export const VERTEX_300 = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

export function fragment300(waves: number): string {
  return `#version 300 es
precision highp float;${UNIFORMS}
out vec4 o;
${fieldSource(waves)}
void main(){${LINE}
  ${PREMULTIPLIED}
  o = vec4(uC * a, a);
}`;
}

/** Запасной WebGL1 (GLSL ES 1.00): та же формула, старый синтаксис.
 *  dFdx/dFdy там — расширение, поэтому строка #extension сверху. */
export const VERTEX_100 = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

export function fragment100(waves: number): string {
  return `#extension GL_OES_standard_derivatives : enable
precision highp float;${UNIFORMS}
${fieldSource(waves)}
void main(){${LINE}
  ${PREMULTIPLIED}
  gl_FragColor = vec4(uC * a, a);
}`;
}

/** Юниформы кадра — чистый расчёт, проверяется тестом.
 *  uScale (пикселей экрана на клетку узора) считается от ширины холста:
 *  рисунок укладывается tilesAcross раз по ширине экрана, поэтому на
 *  телефоне он такой же плотный, как на компьютере. Пересчёт каждый кадр —
 *  значит поворот телефона и смена размера окна учтены сами собой.
 *  Сдвиг при прокрутке умножается на dpr: шейдер считает в пикселях холста.
 *  Толщина — тоже: в настройках она в пикселях CSS, чтобы линия выглядела
 *  одинаково на экранах с любой плотностью точек.
 *  Режим «не двигается» останавливает только время линий (uT = 0);
 *  сдвиг при прокрутке работает как обычно (решение архитектора). */
export function contoursUniforms(settings: BackgroundSettings, frame: Frame) {
  const still = settings.mode === "static";
  return {
    /** uT, секунды */
    t: still ? 0 : frame.t,
    /** uScale */
    scale: (frame.width * frame.dpr) / settings.tilesAcross,
    /** uW — полутолщина линии в пикселях холста */
    width: settings.width * frame.dpr,
    /** uA */
    opacity: settings.opacity,
    /** uSpeed */
    speed: settings.speed,
    /** uOff.y (uOff.x всегда 0) */
    offY: -(frame.scroll * settings.parallax * frame.dpr),
    /** uC */
    rgb: RGB[settings.color],
    /** Сколько волн в field() на этом уровне качества */
    waves: WAVES_BY_QUALITY[frame.quality],
  };
}

export interface ContoursLayer extends Layer {
  /** Панель /dev/motion меняет настройки на ходу. */
  setSettings(next: BackgroundSettings): void;
  getSettings(): BackgroundSettings;
}

export const CONTOURS_LAYER_ID = "contours";

/** Собранная программа под одно число волн. */
interface Built {
  program: WebGLProgram;
  attrib: number;
  u: Record<string, WebGLUniformLocation | null>;
}

export function createContoursLayer(
  initial: BackgroundSettings,
): ContoursLayer {
  let settings = initial;
  let buffer: WebGLBuffer | null = null;
  // Программ столько, сколько уровней качества успело побывать: поле на
  // каждом своё, а пересобирать шейдер на кадре нельзя
  const built = new Map<number, Built | null>();

  function build(gl: GL, waves: number): Built | null {
    const cached = built.get(waves);
    if (cached !== undefined) return cached;
    const gl2 = isGL2(gl);
    const program = createProgram(
      gl,
      gl2 ? VERTEX_300 : VERTEX_100,
      gl2 ? fragment300(waves) : fragment100(waves),
    );
    if (!program) {
      built.set(waves, null);
      return null;
    }
    const u: Record<string, WebGLUniformLocation | null> = {};
    for (const name of ["uT", "uScale", "uW", "uA", "uSpeed", "uOff", "uC"])
      u[name] = gl.getUniformLocation(program, name);
    const item: Built = {
      program,
      attrib: gl.getAttribLocation(program, "p"),
      u,
    };
    built.set(waves, item);
    return item;
  }

  return {
    id: CONTOURS_LAYER_ID,
    zIndex: 0,

    init(gl: GL) {
      buffer = createFullscreenTriangle(gl);
      // Полное поле собираем сразу: первый кадр рисуется на первом уровне
      build(gl, MAX_WAVES);
    },

    render(gl: GL, frame: Frame) {
      if (!buffer) return;
      const v = contoursUniforms(settings, frame);
      const current = build(gl, v.waves);
      if (!current || current.attrib < 0) return;
      const { program, attrib, u } = current;
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(attrib);
      gl.vertexAttribPointer(attrib, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(u.uT, v.t);
      gl.uniform1f(u.uScale, v.scale);
      gl.uniform1f(u.uW, v.width);
      gl.uniform1f(u.uA, v.opacity);
      gl.uniform1f(u.uSpeed, v.speed);
      gl.uniform2f(u.uOff, 0, v.offY);
      gl.uniform3f(u.uC, v.rgb[0], v.rgb[1], v.rgb[2]);
      // Линии кладутся на кремовый фон страницы. Цвет из шейдера уже
      // домножен на альфу (см. PREMULTIPLIED выше и комментарий в gl.ts),
      // поэтому источник берётся как есть: ONE, а не SRC_ALPHA.
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },

    dispose(gl: GL) {
      if (buffer) gl.deleteBuffer(buffer);
      for (const item of built.values()) {
        if (item) gl.deleteProgram(item.program);
      }
      built.clear();
      buffer = null;
    },

    setSettings(next: BackgroundSettings) {
      settings = next;
    },

    getSettings() {
      return settings;
    },
  };
}
