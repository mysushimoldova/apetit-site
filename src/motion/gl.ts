// Мелкая обвязка WebGL: контекст, программа, полноэкранный треугольник.
// Ничего про конкретные эффекты — это дело слоёв (src/motion/layers).
import type { GL } from "./types";

/** Настройки контекста: прозрачный холст, цвета НЕ домножены на альфу
 *  (иначе линии с opacity 0.45 потемнеют), сглаживание не нужно —
 *  края линий даёт сам шейдер. */
const CONTEXT_ATTRS: WebGLContextAttributes = {
  alpha: true,
  premultipliedAlpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  powerPreference: "low-power",
  // Холст декоративный: если браузер решит, что контекст пора отобрать, —
  // пусть отбирает, мы уйдём на уровень 4 без ошибок
  failIfMajorPerformanceCaveat: false,
};

export interface GLContext {
  gl: GL;
  /** 2 — WebGL2, 1 — запасной WebGL1 + OES_standard_derivatives. */
  version: 1 | 2;
}

/** Контекст для холста или null, если WebGL нет (движок тогда выключен). */
export function createContext(canvas: HTMLCanvasElement): GLContext | null {
  const gl2 = canvas.getContext("webgl2", CONTEXT_ATTRS);
  if (gl2) return { gl: gl2 as WebGL2RenderingContext, version: 2 };
  const gl1 = canvas.getContext("webgl", CONTEXT_ATTRS);
  // Без производных (fwidth) линии нечем сгладить — считаем, что WebGL нет
  if (!gl1 || !gl1.getExtension("OES_standard_derivatives")) return null;
  return { gl: gl1 as WebGLRenderingContext, version: 1 };
}

export function isGL2(gl: GL): gl is WebGL2RenderingContext {
  return (
    typeof WebGL2RenderingContext !== "undefined" &&
    gl instanceof WebGL2RenderingContext
  );
}

function compile(gl: GL, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

/** Собранная программа или null. Молча: холст декоративный, ронять сайт
 *  из-за него нельзя. */
export function createProgram(
  gl: GL,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram | null {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    return null;
  }
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  // Шейдеры дальше не нужны: программа их удержит сама
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  gl.deleteProgram(program);
  return null;
}

/** Треугольник, накрывающий весь экран (дешевле двух треугольников: одна
 *  фигура, нет шва по диагонали). */
export const FULLSCREEN_TRIANGLE = new Float32Array([-1, -1, 3, -1, -1, 3]);

export function createFullscreenTriangle(gl: GL): WebGLBuffer | null {
  const buffer = gl.createBuffer();
  if (!buffer) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_TRIANGLE, gl.STATIC_DRAW);
  return buffer;
}
