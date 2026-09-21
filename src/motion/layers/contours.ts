// Слой живого фона: фирменные контурные линии (DESIGN.md → Background).
//
// Поле складывается из десяти волн с разными направлениями, фазами и
// скоростями; линии — это его «горизонтали» (уровни), ширина линии берётся
// из производной поля (fwidth), поэтому она одинаковая при любом масштабе.
// Формула проверена на макете и не меняется: правки — только через
// настройки в src/config/motion.json и панель /dev/motion.
import type { BackgroundSettings, ContourColor } from "../config-schema";
import { createFullscreenTriangle, createProgram, isGL2 } from "../gl";
import type { Frame, GL, Layer } from "../types";

/** Цвета линий в шейдере — те же, что CONTOUR_COLORS в config-schema.ts
 *  (там zod, он в браузер не идёт; здесь — только числа). */
const RGB: Record<ContourColor, [number, number, number]> = {
  ash: [0xa7 / 255, 0x9e / 255, 0x95 / 255],
  smoke: [0x7a / 255, 0x71 / 255, 0x6a / 255],
  sand: [0xea / 255, 0xe2 / 255, 0xd5 / 255],
};

/** Общая часть фрагментного шейдера: поле волн. */
const FIELD = `
float W(vec2 p, float nx, float ny, float ph, float sp, float a){
  return a * sin(6.2831853 * (nx*p.x + ny*p.y) + ph + uT*sp*uSpeed);
}
float field(vec2 p){
  float v = 0.;
  v += W(p, 1.,0.,0.7,0.30,0.95);
  v += W(p, 0.,1.,2.1,-0.22,0.80);
  v += W(p, 1.,1.,4.0,0.17,0.55);
  v += W(p, 2.,-1.,1.2,-0.31,0.40);
  v += W(p, -1.,2.,5.4,0.24,0.36);
  v += W(p, 2.,2.,3.3,-0.14,0.26);
  v += W(p, 3.,-1.,0.4,0.27,0.20);
  v += W(p, -2.,3.,2.7,-0.19,0.18);
  v += W(p, 3.,2.,5.9,0.12,0.14);
  v += W(p, -3.,1.,1.8,-0.26,0.13);
  return v;
}`;

/** Общая часть main(): из поля — одна линия с мягкими краями. */
const LINE = `
  vec2 p = (gl_FragCoord.xy + uOff) / uScale;
  float v = field(p) * 3.2;
  float g = abs(fract(v) - 0.5);
  float w = fwidth(v);
  float line = 1.0 - smoothstep(0.0, uW * w, g);`;

const UNIFORMS = `
uniform float uT, uScale, uW, uA, uSpeed;
uniform vec2 uOff;
uniform vec3 uC;`;

/** WebGL2 (GLSL ES 3.00). */
export const VERTEX_300 = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

export const FRAGMENT_300 = `#version 300 es
precision highp float;${UNIFORMS}
out vec4 o;
${FIELD}
void main(){${LINE}
  o = vec4(uC, line * uA);
}`;

/** Запасной WebGL1 (GLSL ES 1.00): та же формула, старый синтаксис.
 *  fwidth там — расширение, поэтому строка #extension сверху. */
export const VERTEX_100 = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

export const FRAGMENT_100 = `#extension GL_OES_standard_derivatives : enable
precision highp float;${UNIFORMS}
${FIELD}
void main(){${LINE}
  gl_FragColor = vec4(uC, line * uA);
}`;

/** Юниформы кадра — чистый расчёт, проверяется тестом.
 *  uScale и сдвиг умножаются на dpr: шейдер считает в пикселях холста. */
export function contoursUniforms(settings: BackgroundSettings, frame: Frame) {
  const still = settings.mode === "static";
  return {
    /** uT, секунды */
    t: still ? 0 : frame.t,
    /** uScale */
    scale: settings.scale * frame.dpr,
    /** uW */
    width: settings.width,
    /** uA */
    opacity: settings.opacity,
    /** uSpeed */
    speed: settings.speed,
    /** uOff.y (uOff.x всегда 0) */
    offY: still ? 0 : -(frame.scroll * settings.parallax * frame.dpr),
    /** uC */
    rgb: RGB[settings.color],
  };
}

export interface ContoursLayer extends Layer {
  /** Панель /dev/motion меняет настройки на ходу. */
  setSettings(next: BackgroundSettings): void;
  getSettings(): BackgroundSettings;
}

export const CONTOURS_LAYER_ID = "contours";

export function createContoursLayer(
  initial: BackgroundSettings,
): ContoursLayer {
  let settings = initial;
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let attrib = -1;
  let u: Record<string, WebGLUniformLocation | null> = {};

  return {
    id: CONTOURS_LAYER_ID,
    zIndex: 0,

    init(gl: GL) {
      const gl2 = isGL2(gl);
      program = createProgram(
        gl,
        gl2 ? VERTEX_300 : VERTEX_100,
        gl2 ? FRAGMENT_300 : FRAGMENT_100,
      );
      if (!program) return;
      buffer = createFullscreenTriangle(gl);
      attrib = gl.getAttribLocation(program, "p");
      u = {};
      for (const name of ["uT", "uScale", "uW", "uA", "uSpeed", "uOff", "uC"])
        u[name] = gl.getUniformLocation(program, name);
    },

    render(gl: GL, frame: Frame) {
      if (!program || !buffer || attrib < 0) return;
      const v = contoursUniforms(settings, frame);
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
      // Линии кладутся на кремовый фон страницы обычной прозрачностью
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },

    dispose(gl: GL) {
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      buffer = null;
      program = null;
      attrib = -1;
      u = {};
    },

    setSettings(next: BackgroundSettings) {
      settings = next;
    },

    getSettings() {
      return settings;
    },
  };
}
