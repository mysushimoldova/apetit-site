// Слой заставки категории: жёлтый круг и настоящее блюдо поверх него.
// Рисует в тот же холст и тот же контекст, что фон, — своей программой
// (docs/motion/splash-prompt.md, эталон docs/motion/splash-demo.html).
//
// Блюдо приходит двумя способами, и оба рисует этот же слой — чтобы
// поведение и настройки заставки были едиными:
//  • ролик (<video>) — там, где он снят: блюдо вращается;
//  • фото (<img>) — у категорий без ролика: та же вырезка, что на плитке
//    меню. Движение размера, высоты и круга у них одно и то же.
//
// Формат ролика особый: верхняя половина кадра — цвет, нижняя — маска
// (альфа) того же кадра, поэтому файл вдвое выше видимого. Маска посчитана
// заранее нейросетью: фон и тень убраны, внутри силуэта продукт сплошной.
// В цветной половине внизу слева два квадрата 16×16 — чёрный и белый: по
// ним шейдер растягивает диапазон обратно, потому что часть браузеров
// отдаёт видео в WebGL сжатым до 16…235.
//
// Важно: эталоны читаются ОДИН РАЗ на ролик — отдельным пре-проходом с
// усреднением по 10×10 пикселей (программа CFS в эталоне). Когда их читали
// в каждом кадре одной точкой, сжатие видео слегка меняло эти пиксели от
// кадра к кадру, и у блюда мерцала яркость.
//
// Нужен WebGL2: texelFetch и textureSize в WebGL1 недоступны, а без них
// эталоны не прочитать. Нет WebGL2 — слой молча ничего не рисует, и
// заставки на сайте не будет (переход к категории обычный).
import { createFullscreenTriangle, createProgram, isGL2 } from "../gl";
import { splashDishWidth } from "../splash/geometry";
import type { SplashVisual } from "../splash/timeline";
import type { Frame, GL, Layer } from "../types";

export const SPLASH_LAYER_ID = "splash";

/** Фирменный жёлтый (DESIGN.md → Tokens): #FFBC0D. */
const YELLOW: [number, number, number] = [1, 0xbc / 255, 0x0d / 255];

/** Эталонные квадраты в кадре (scripts/splash-video/ai_matte.py, finish):
 *  чёрный — столбцы 0…15, белый — 16…31, последние 16 строк цветной
 *  половины. Читаем квадрат 10×10 внутри каждого, отступив от краёв. */
const CAL_SIZE = 10;
const CAL_BLACK_X = 3;
const CAL_WHITE_X = 19;
const CAL_BOTTOM = 13;

/** Разница чёрного и белого меньше этой — кадр ещё не тот (ролик не
 *  начался, текстура пустая): калибровку повторим на следующем кадре. */
const CAL_MIN_RANGE = 0.3;

const VERTEX = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

// uRect — прямоугольник блюда в пикселях холста (x0, y0, x1, y1), отсчёт
// снизу, как у gl_FragCoord. uDisc — центр и радиус круга там же.
// uCal — чёрный и белый эталоны ролика, посчитанные пре-проходом.
const FRAGMENT = `#version 300 es
precision mediump float;
uniform sampler2D tex;
uniform vec4 uRect;
uniform vec3 uDisc;
uniform vec3 uYellow;
uniform vec2 uCal;
uniform float uAlpha, uPhoto;
out vec4 o;

vec4 dish(vec2 u){
  // И ролик, и картинка идут сверху вниз, а холст снизу вверх
  vec2 uv = vec2(u.x, 1.0 - u.y);
  if (uPhoto > 0.5){
    // Фото — обычный WebP с настоящей прозрачностью: ни маски в нижней
    // половине кадра, ни калибровки по эталонным квадратам не нужно
    vec4 c = texture(tex, uv);
    return vec4(c.rgb * c.a, c.a);
  }
  float lo = uCal.x;
  float k = 1.0 / max(uCal.y - uCal.x, 0.25);
  vec3 c  = clamp((texture(tex, vec2(uv.x, uv.y * 0.5)).rgb - lo) * k, 0.0, 1.0);
  float a = clamp((texture(tex, vec2(uv.x, 0.5 + uv.y * 0.5)).r - lo) * k, 0.0, 1.0);
  a = smoothstep(0.12, 0.94, a);   // отсечь шум сжатия вокруг продукта
  return vec4(c * a, a);
}

void main(){
  float d = length(gl_FragCoord.xy - uDisc.xy) - uDisc.z;
  float disc = 1.0 - smoothstep(-1.0, 1.0, d);
  vec4 col = vec4(uYellow * disc, disc);

  vec2 u = (gl_FragCoord.xy - uRect.xy) / max(uRect.zw - uRect.xy, vec2(1.0));
  vec4 a = (u.x < 0.0 || u.x > 1.0 || u.y < 0.0 || u.y > 1.0)
    ? vec4(0.0)
    : dish(u);

  o = (a + col * (1.0 - a.a)) * uAlpha;
}`;

// Пре-проход калибровки: считает средние чёрного и белого эталонов и кладёт
// их в текстуру 2×1 (левый пиксель — чёрный, правый — белый).
const CAL_VERTEX = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p,0.,1.); }`;

const CAL_FRAGMENT = `#version 300 es
precision mediump float;
in vec2 uv; uniform sampler2D t; out vec4 o;
void main(){
  ivec2 sz = textureSize(t, 0);
  int hh = sz.y / 2;
  int x0 = uv.x < 0.5 ? ${CAL_BLACK_X} : ${CAL_WHITE_X};
  float s = 0.0;
  for (int y = 0; y < ${CAL_SIZE}; y++)
    for (int x = 0; x < ${CAL_SIZE}; x++)
      s += texelFetch(t, ivec2(x0 + x, hh - ${CAL_BOTTOM} + y), 0).r;
  o = vec4(vec3(s / ${CAL_SIZE * CAL_SIZE}.0), 1.0);
}`;

/** Источник картинки для видеокарты: ролик или фото. */
export type SplashMedia = HTMLVideoElement | HTMLImageElement;

/** Что слой рисует в этом кадре. Всё считает контроллер заставки. */
export interface SplashDraw extends SplashVisual {
  /** Блюдо этой категории — одно, всегда. */
  media: SplashMedia | null;
  /** Фото вместо ролика: у него своя, простая распаковка в шейдере. */
  photo: boolean;
}

export interface SplashLayer extends Layer {
  /** Показывать заставку (null — не рисовать ничего). */
  setDraw(draw: SplashDraw | null): void;
  /** Работает ли слой вообще: нет WebGL2 — заставки не будет. */
  isSupported(): boolean;
}

/** Ролик уже можно отдать видеокарте. */
function videoReady(video: HTMLVideoElement): boolean {
  return video.readyState >= 2 && video.videoWidth > 0;
}

function isVideo(media: SplashMedia): media is HTMLVideoElement {
  return media.tagName === "VIDEO";
}

/** Пропорции кадра: ширина к видимой высоте. У ролика видимая высота —
 *  половина файла (внизу лежит маска), у фото — вся картинка. */
function aspectOf(media: SplashMedia | null): number {
  if (!media) return 0;
  if (isVideo(media)) {
    if (!media.videoWidth || !media.videoHeight) return 0;
    return media.videoWidth / (media.videoHeight / 2);
  }
  if (!media.naturalWidth || !media.naturalHeight) return 0;
  return media.naturalWidth / media.naturalHeight;
}

export function createSplashLayer(): SplashLayer {
  let buffer: WebGLBuffer | null = null;
  let program: WebGLProgram | null = null;
  let calProgram: WebGLProgram | null = null;
  let calBuffer: WebGLFramebuffer | null = null;
  let calTexture: WebGLTexture | null = null;
  let calSampler: WebGLUniformLocation | null = null;
  let attrib = -1;
  let calAttrib = -1;
  let supported = true;
  let texture: WebGLTexture | null = null;
  /** Какое фото уже лежит на текстуре: второй раз не грузим. */
  let uploaded: SplashMedia | null = null;
  /** Чёрный и белый эталоны текущего ролика и чей они. */
  let cal: [number, number] = [0, 1];
  let calFor: SplashMedia | null = null;
  let draw: SplashDraw | null = null;
  const u: Record<string, WebGLUniformLocation | null> = {};

  function makeTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
    const tex = gl.createTexture();
    if (!tex) return null;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    );
    return tex;
  }

  /**
   * Прочитать эталоны ролика — один раз на ролик. Рисуем пре-проходом в
   * картинку 2×1 и забираем два числа; после этого шейдер берёт их из
   * uniform и в кадре ничего не читает.
   */
  function calibrate(gl: WebGL2RenderingContext, media: SplashMedia): void {
    if (!calProgram || !calBuffer || calAttrib < 0) return;
    gl.useProgram(calProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(calAttrib);
    gl.vertexAttribPointer(calAttrib, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(calSampler, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, calBuffer);
    gl.viewport(0, 0, 2, 1);
    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const px = new Uint8Array(8);
    gl.readPixels(0, 0, 2, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    const lo = px[0] / 255;
    const hi = px[4] / 255;
    // Пока разница мала, кадра ещё нет — попробуем на следующем
    if (hi - lo > CAL_MIN_RANGE) {
      cal = [lo, hi];
      calFor = media;
    }
  }

  function upload(gl: WebGL2RenderingContext, media: SplashMedia): boolean {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (isVideo(media)) {
      // У ролика каждый кадр новый — отдаём видеокарте каждый раз
      if (!videoReady(media)) return uploaded === media;
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        media,
      );
      uploaded = media;
      if (calFor !== media) calibrate(gl, media);
      return true;
    }
    // Фото не меняется — грузим один раз, а не по кадру на каждый кадр
    if (uploaded === media) return true;
    if (!media.complete || !media.naturalWidth) return false;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, media);
    uploaded = media;
    return true;
  }

  /** Прямоугольник блюда в пикселях холста, отсчёт снизу. */
  function rect(
    frame: Frame,
    aspect: number,
    current: SplashDraw,
  ): [number, number, number, number] {
    const width =
      splashDishWidth({
        stageWidth: frame.width,
        stageHeight: frame.height,
        aspect,
      }) * current.dishScale;
    const height = width / aspect;
    const dpr = frame.dpr;
    const cx = (frame.width / 2 + current.zoomX * frame.width) * dpr;
    // Ось холста идёт вверх, а высота блюда и сдвиг «в меню» считаются вниз
    // по экрану; заставка-шторка, наоборот, уезжает вверх.
    const cy =
      (frame.height / 2 -
        current.dishY +
        current.liftShare * frame.height -
        current.zoomY * frame.height) *
      dpr;
    const hw = (width * dpr) / 2;
    const hh = (height * dpr) / 2;
    return [cx - hw, cy - hh, cx + hw, cy + hh];
  }

  return {
    id: SPLASH_LAYER_ID,
    // Поверх фона и карточек: заставка старше всех (docs/MOTION.md §1)
    zIndex: 100,

    init(gl: GL) {
      if (!isGL2(gl)) {
        supported = false;
        return;
      }
      buffer = createFullscreenTriangle(gl);
      program = createProgram(gl, VERTEX, FRAGMENT);
      calProgram = createProgram(gl, CAL_VERTEX, CAL_FRAGMENT);
      if (!program || !calProgram || !buffer) {
        supported = false;
        return;
      }
      attrib = gl.getAttribLocation(program, "p");
      calAttrib = gl.getAttribLocation(calProgram, "p");
      calSampler = gl.getUniformLocation(calProgram, "t");
      for (const name of [
        "tex",
        "uRect",
        "uDisc",
        "uYellow",
        "uCal",
        "uAlpha",
        "uPhoto",
      ]) {
        u[name] = gl.getUniformLocation(program, name);
      }
      texture = makeTexture(gl);

      // Картинка 2×1, в которую пишет пре-проход калибровки
      calTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, calTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        2,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      calBuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, calBuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        calTexture,
        0,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      gl.useProgram(program);
      gl.uniform1i(u.tex, 0);
    },

    render(gl: GL, frame: Frame) {
      const current = draw;
      if (!current || !current.visible || !current.media) return;
      if (!supported || !program || !buffer || attrib < 0 || !isGL2(gl)) return;

      const aspect = aspectOf(current.media);
      if (aspect <= 0) return;
      if (!upload(gl, current.media)) return;

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(attrib);
      gl.vertexAttribPointer(attrib, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);

      const box = rect(frame, aspect, current);
      gl.uniform4f(u.uRect, box[0], box[1], box[2], box[3]);

      // Круг сидит посередине экрана и живёт своей жизнью: размер, кривая и
      // высота у него свои (эталон, функция layout)
      const radius = (current.disc * frame.width * frame.dpr) / 2;
      const discY =
        (frame.height / 2 - current.discY + current.liftShare * frame.height) *
        frame.dpr;
      gl.uniform3f(u.uDisc, (frame.width / 2) * frame.dpr, discY, radius);
      gl.uniform3f(u.uYellow, YELLOW[0], YELLOW[1], YELLOW[2]);
      gl.uniform2f(u.uCal, cal[0], cal[1]);
      gl.uniform1f(u.uAlpha, current.alpha);
      gl.uniform1f(u.uPhoto, current.photo ? 1 : 0);

      // Цвет уже домножен на альфу (как в слое фона, см. src/motion/gl.ts)
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },

    dispose(gl: GL) {
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      if (calProgram) gl.deleteProgram(calProgram);
      if (texture) gl.deleteTexture(texture);
      if (calTexture) gl.deleteTexture(calTexture);
      if (calBuffer) gl.deleteFramebuffer(calBuffer);
      texture = null;
      calTexture = null;
      calBuffer = null;
      calProgram = null;
      uploaded = null;
      calFor = null;
      buffer = null;
      program = null;
      draw = null;
    },

    setDraw(next: SplashDraw | null) {
      draw = next;
      // Новое блюдо — новые эталоны: старые числа к нему отношения не имеют
      if (next && next.media !== uploaded) calFor = null;
    },

    isSupported() {
      return supported;
    },
  };
}
