// Слой заставки категории: жёлтый круг и настоящее блюдо поверх него.
// Рисует в тот же холст и тот же контекст, что фон, — своей программой
// (docs/motion/splash-prompt.md, эталон docs/motion/splash-demo.html).
//
// Блюдо приходит двумя способами, и оба рисует этот же слой — чтобы
// поведение и настройки заставки были едиными:
//  • ролик (<video>) — там, где он снят: блюдо вращается;
//  • фото (<img>) — у категорий без ролика: та же вырезка, что на плитке
//    меню. Фото не вращается, его движение считает контроллер.
//
// Формат ролика особый: верхняя половина кадра — цвет, нижняя — маска
// (альфа) того же кадра, поэтому файл вдвое выше видимого. Маска посчитана
// заранее нейросетью: фон и тень убраны, внутри силуэта продукт сплошной.
// В цветной половине внизу слева два квадрата 16×16 — чёрный и белый: по
// ним шейдер растягивает диапазон обратно, потому что часть браузеров
// отдаёт видео в WebGL сжатым до 16…235.
//
// Нужен WebGL2: texelFetch и textureSize в WebGL1 недоступны, а без них
// эталоны не прочитать. Нет WebGL2 — слой молча ничего не рисует, и
// заставки на сайте не будет (переход к категории обычный).
import { createFullscreenTriangle, createProgram, isGL2 } from "../gl";
import { splashVideoWidth } from "../splash/geometry";
import type { SplashVisual } from "../splash/timeline";
import type { Frame, GL, Layer } from "../types";

export const SPLASH_LAYER_ID = "splash";

/** Фирменный жёлтый (DESIGN.md → Tokens): #FFBC0D. */
const YELLOW: [number, number, number] = [1, 0xbc / 255, 0x0d / 255];

const VERTEX = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

// uRect — прямоугольник блюда в пикселях холста (x0, y0, x1, y1), отсчёт
// снизу, как у gl_FragCoord. uDisc — центр и радиус круга там же.
const FRAGMENT = `#version 300 es
precision mediump float;
uniform sampler2D tA, tB;
uniform vec4 uRectA, uRectB;
uniform vec3 uDisc;
uniform vec3 uYellow;
uniform float uDiscA, uFoodA, uMix, uPhoto;
out vec4 o;

vec4 key(sampler2D t, vec2 u){
  // Калибровка по эталонным квадратам ролика (чёрный и белый, где маска = 0)
  ivec2 sz = textureSize(t, 0); int hh = sz.y / 2;
  float lo = texelFetch(t, ivec2(8,  hh - 8), 0).r;
  float hi = texelFetch(t, ivec2(24, hh - 8), 0).r;
  float k = 1.0 / max(hi - lo, 0.25);
  vec3 c  = clamp((texture(t, vec2(u.x, u.y * 0.5)).rgb - lo) * k, 0.0, 1.0);
  float a = clamp((texture(t, vec2(u.x, 0.5 + u.y * 0.5)).r - lo) * k, 0.0, 1.0);
  a = smoothstep(0.12, 0.94, a);   // отсечь шум сжатия вокруг продукта
  return vec4(c * a, a);
}

vec4 food(sampler2D t, vec4 rect){
  vec2 u = (gl_FragCoord.xy - rect.xy) / max(rect.zw - rect.xy, vec2(1.0));
  if (u.x < 0.0 || u.x > 1.0 || u.y < 0.0 || u.y > 1.0) return vec4(0.0);
  // И ролик, и картинка идут сверху вниз, а холст снизу вверх
  vec2 uv = vec2(u.x, 1.0 - u.y);
  if (uPhoto > 0.5){
    // Фото — обычный WebP с настоящей прозрачностью: ни маски в нижней
    // половине кадра, ни калибровки по эталонным квадратам не нужно
    vec4 c = texture(t, uv);
    return vec4(c.rgb * c.a, c.a);
  }
  return key(t, uv);
}

void main(){
  float d = length(gl_FragCoord.xy - uDisc.xy) - uDisc.z;
  float disc = (1.0 - smoothstep(-1.0, 1.0, d)) * uDiscA;
  vec4 col = vec4(uYellow * disc, disc);

  vec4 a = food(tA, uRectA) * uFoodA;
  // Второе блюдо не растворяется, а закрывает первое: там, где силуэты не
  // совпадают, растворение давало бы просвечивание (эталон, функция main)
  if (uMix > 0.0){
    vec4 b = food(tB, uRectB) * uFoodA;
    a = b + a * (1.0 - b.a);
  }
  o = a + col * (1.0 - a.a);
}`;

/** Источник картинки для видеокарты: ролик или фото. */
export type SplashMedia = HTMLVideoElement | HTMLImageElement;

/** Что слой рисует в этом кадре. Всё считает контроллер заставки. */
export interface SplashDraw extends SplashVisual {
  /** Блюда: первое — текущее, второе (если есть) — сменяющее его. */
  media: readonly SplashMedia[];
  /** Фото вместо ролика: у него своя, простая распаковка в шейдере. */
  photo: boolean;
  /** Подъём блюда вверх, CSS-пиксели (движение фото). */
  risePx: number;
  /** Доля смены блюда 0…1 (0 — второго нет). */
  mix: number;
  /** Масштаб уходящего и приходящего блюда при смене. */
  scaleA: number;
  scaleB: number;
  /** Размер блюда, доля ширины экрана (настройка zoom). */
  zoom: number;
  /** Радиус жёлтого круга, доля ширины экрана (настройка disc). */
  disc: number;
}

export interface SplashLayer extends Layer {
  /** Показывать заставку (null — не рисовать ничего). */
  setDraw(draw: SplashDraw | null): void;
  /** Работает ли слой вообще: нет WebGL2 — заставки не будет. */
  isSupported(): boolean;
  /** Где сейчас блюдо, в CSS-пикселях: по этим числам оверлей ставит слово
   *  категории и подсказку. */
  foodBox(frame: { width: number; height: number }): {
    width: number;
    height: number;
    centerY: number;
  } | null;
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
function aspectOf(media: SplashMedia | undefined): number {
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
  let attrib = -1;
  let supported = true;
  let textures: [WebGLTexture | null, WebGLTexture | null] = [null, null];
  /** Какое фото уже лежит на каждой текстуре: второй раз не грузим. */
  let uploaded: [SplashMedia | null, SplashMedia | null] = [null, null];
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

  function upload(
    gl: WebGL2RenderingContext,
    unit: 0 | 1,
    media: SplashMedia | undefined,
  ): void {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, textures[unit]);
    if (!media) return;
    if (isVideo(media)) {
      // У ролика каждый кадр новый — отдаём видеокарте каждый раз
      if (videoReady(media)) {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          media,
        );
      }
      return;
    }
    // Фото не меняется — грузим один раз, а не по кадру на каждый кадр
    if (uploaded[unit] === media || !media.complete || !media.naturalWidth) {
      return;
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, media);
    uploaded[unit] = media;
  }

  /** Прямоугольник блюда в пикселях холста, отсчёт снизу. */
  function rect(
    frame: Frame,
    aspect: number,
    scale: number,
    current: SplashDraw,
  ): [number, number, number, number] {
    const width =
      splashVideoWidth({
        stageWidth: frame.width,
        stageHeight: frame.height,
        aspect,
        zoom: current.zoom,
      }) * scale;
    const height = aspect > 0 ? width / aspect : 0;
    const dpr = frame.dpr;
    const cx = (frame.width / 2 + current.zoomX * frame.width) * dpr;
    // Заставка уезжает вверх шторкой: блюдо уходит вместе с ней.
    // risePx — своё движение фото: экранный верх — это плюс по оси холста.
    const cy =
      (frame.height / 2 +
        current.liftShare * frame.height +
        current.zoomY * frame.height) *
        dpr +
      current.risePx * dpr;
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
      if (!program) {
        supported = false;
        return;
      }
      attrib = gl.getAttribLocation(program, "p");
      for (const name of [
        "tA",
        "tB",
        "uRectA",
        "uRectB",
        "uDisc",
        "uYellow",
        "uDiscA",
        "uFoodA",
        "uMix",
        "uPhoto",
      ]) {
        u[name] = gl.getUniformLocation(program, name);
      }
      textures = [makeTexture(gl), makeTexture(gl)];
      gl.useProgram(program);
      gl.uniform1i(u.tA, 0);
      gl.uniform1i(u.tB, 1);
    },

    render(gl: GL, frame: Frame) {
      const current = draw;
      if (!current || !current.visible) return;
      if (!supported || !program || !buffer || attrib < 0 || !isGL2(gl)) return;

      const [a, b] = current.media;
      const aspectA = aspectOf(a);
      if (aspectA <= 0) return;
      const aspectB = aspectOf(b) || aspectA;

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(attrib);
      gl.vertexAttribPointer(attrib, 2, gl.FLOAT, false, 0, 0);

      upload(gl, 0, a);
      upload(gl, 1, b ?? a);

      const rectA = rect(
        frame,
        aspectA,
        current.foodScale * current.scaleA,
        current,
      );
      const rectB = rect(
        frame,
        aspectB,
        current.foodScale * current.scaleB,
        current,
      );
      gl.uniform4f(u.uRectA, rectA[0], rectA[1], rectA[2], rectA[3]);
      gl.uniform4f(u.uRectB, rectB[0], rectB[1], rectB[2], rectB[3]);

      // Круг сидит под блюдом: центр — чуть ниже середины блюда, как в эталоне
      const foodHeight = (rectA[3] - rectA[1]) / current.foodScale;
      const radius = (current.disc * frame.width * frame.dpr) / 2;
      const discY = (rectA[1] + rectA[3]) / 2 - foodHeight * 0.02;
      gl.uniform3f(
        u.uDisc,
        (frame.width / 2) * frame.dpr,
        discY,
        radius * current.discScale,
      );
      gl.uniform3f(u.uYellow, YELLOW[0], YELLOW[1], YELLOW[2]);
      gl.uniform1f(u.uDiscA, current.discAlpha);
      gl.uniform1f(u.uFoodA, current.foodAlpha);
      gl.uniform1f(u.uMix, current.mix > 0 && b ? 1 : 0);
      gl.uniform1f(u.uPhoto, current.photo ? 1 : 0);

      // Цвет уже домножен на альфу (как в слое фона, см. src/motion/gl.ts)
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },

    dispose(gl: GL) {
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      for (const tex of textures) if (tex) gl.deleteTexture(tex);
      textures = [null, null];
      uploaded = [null, null];
      buffer = null;
      program = null;
      draw = null;
    },

    setDraw(next: SplashDraw | null) {
      draw = next;
    },

    isSupported() {
      return supported;
    },

    foodBox(frame) {
      const current = draw;
      const aspect = aspectOf(current?.media[0]);
      if (!current || aspect <= 0) return null;
      const width = splashVideoWidth({
        stageWidth: frame.width,
        stageHeight: frame.height,
        aspect,
        zoom: current.zoom,
      });
      return { width, height: width / aspect, centerY: frame.height / 2 };
    },
  };
}
