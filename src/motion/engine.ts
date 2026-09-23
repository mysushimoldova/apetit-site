// Движок анимаций сайта: один <canvas> на весь экран, один контекст WebGL,
// один цикл кадров. Эффекты подключаются слоями (src/motion/types.ts),
// каждый слой владеет своими буферами и шейдерами.
//
// Правила, по которым движок живёт:
//  • Качество. Четыре уровня (src/motion/quality.ts). Первые две секунды
//    считаем кадры: медленно — уровень ниже, совсем медленно — стоп.
//    Уровень помнится в sessionStorage на время визита.
//  • Паузы по причинам (src/motion/pause.ts). Цикл идёт, только когда причин
//    нет: спрятана вкладка, открыт лист блюда или корзина, страница сама
//    едет к категории — движок стоит.
//  • «Уменьшить движение» — один кадр, цикл стоит, слои получают t = 0 и
//    scroll = 0.
//  • Потеря контекста — уровень 4, тихо, без ошибок в консоли.
//
// Холст лежит за контентом (z-index −1) и не ловит клики. Он появляется не
// сразу: страницу показывают без него, движок подгружается после контента
// (src/components/motion/motion-stage.tsx).
import { createContext, type GLContext } from "./gl";
import {
  isMotionPaused,
  motionPauseReasons,
  onMotionPauseChange,
  pauseMotion,
  resumeMotion,
} from "./pause";
import {
  canvasDpr,
  MEASURE_WINDOW_MS,
  MEASURE_WINDOWS,
  MIN_FRAME_MS,
  nextQuality,
  readQuality,
  shouldMeasure,
  writeQuality,
  type QualityLevel,
} from "./quality";
import { ScrollSmoother } from "./scroll";
import type { Frame, Layer } from "./types";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Спрятанная вкладка — обычная причина паузы. */
const HIDDEN = "hidden";

/** Сколько ждать перед разборкой движка после размонтирования: переход
 *  между страницами сайта размонтирует и тут же монтирует снова, рвать
 *  контекст WebGL на такой паузе незачем. */
const TEARDOWN_MS = 200;

/** Самый длинный кадр, который считаем настоящим: после сна вкладки
 *  приходит скачок в секунды — он бы дёрнул фон. */
const MAX_FRAME_MS = 100;

export interface MotionStats {
  quality: QualityLevel;
  /** Кадров в секунду за последнее измеренное окно. */
  fps: number;
  /** Сколько кадров нарисовано с запуска. */
  frames: number;
  running: boolean;
  /** Причины, по которым движок стоит. */
  paused: string[];
  reducedMotion: boolean;
  /** Сглаженная прокрутка, px. */
  scroll: number;
  layers: string[];
}

function sessionStorageOrNull(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

class MotionEngine {
  private root: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: GLContext | null = null;
  private layers: Layer[] = [];
  private cleanups: (() => void)[] = [];

  private mounts = 0;
  private teardownTimer = 0;
  private raf = 0;
  private stillRaf = 0;
  private running = false;
  private lost = false;

  private quality: QualityLevel = 1;
  private scroll = new ScrollSmoother(0.1);

  private frames = 0;
  private fps = 0;
  /** Живое время, мс: растёт, только когда цикл идёт (после паузы линии
   *  продолжают с того же места, а не прыгают вперёд). */
  private elapsed = 0;
  private last = 0;
  private windowStart = 0;
  private windowFrames = 0;
  private windowsLeft = MEASURE_WINDOWS;

  private reduced = false;
  private reducedOverride: boolean | null = null;
  private hiddenPaused = false;

  private sizeDirty = true;
  private dpr = 1;
  private cssWidth = 0;
  private cssHeight = 0;

  // ---------- Внешнее управление ----------

  /**
   * Подключить движок к странице. Возвращает отключение.
   * Вызовов может быть несколько (разные страницы) — холст один.
   */
  mount(options?: { scrollEase?: number }): () => void {
    this.mounts++;
    if (this.teardownTimer) {
      clearTimeout(this.teardownTimer);
      this.teardownTimer = 0;
    }
    if (options?.scrollEase !== undefined) {
      this.setScrollEase(options.scrollEase);
    }
    this.create();
    return () => {
      this.mounts = Math.max(0, this.mounts - 1);
      if (this.mounts > 0) return;
      this.teardownTimer = window.setTimeout(() => {
        this.teardownTimer = 0;
        if (this.mounts === 0) this.destroy();
      }, TEARDOWN_MS);
    };
  }

  add(layer: Layer): void {
    this.remove(layer.id);
    this.layers.push(layer);
    this.layers.sort((a, b) => a.zIndex - b.zIndex);
    if (this.ctx) layer.init(this.ctx.gl);
    this.updateLoop();
    this.requestFrame();
  }

  remove(id: string): void {
    const index = this.layers.findIndex((layer) => layer.id === id);
    if (index < 0) return;
    const [layer] = this.layers.splice(index, 1);
    if (this.ctx) layer.dispose(this.ctx.gl);
    this.updateLoop();
    this.requestFrame();
  }

  /** Встать по причине: 'hidden' | 'sheet' | 'cart' | 'scroll' | любая своя. */
  pause(reason: string): void {
    pauseMotion(reason);
  }

  /** Снять свою причину. Цикл пойдёт, когда не останется ни одной. */
  resume(reason: string): void {
    resumeMotion(reason);
  }

  /** Ручное понижение (или возврат) качества. */
  setQuality(level: QualityLevel): void {
    if (level === this.quality) return;
    this.quality = level;
    writeQuality(sessionStorageOrNull(), level);
    this.sizeDirty = true;
    this.updateLoop();
    this.requestFrame();
  }

  /** Инертность общего сглаживания прокрутки. */
  setScrollEase(ease: number): void {
    this.scroll.setEase(ease);
  }

  /** Принудительное «уменьшить движение» — только для панели /dev/motion.
   *  null — как в настройках системы. */
  setReducedMotion(force: boolean | null): void {
    this.reducedOverride = force;
    this.updateLoop();
    this.requestFrame();
  }

  /** Один кадр, когда цикл стоит: после смены настроек, размера, качества. */
  requestFrame(): void {
    if (this.running || !this.ctx || this.lost || this.stillRaf) return;
    this.stillRaf = requestAnimationFrame((now) => {
      this.stillRaf = 0;
      this.draw(now, 0);
    });
  }

  stats(): MotionStats {
    return {
      quality: this.quality,
      fps: this.fps,
      frames: this.frames,
      running: this.running,
      paused: motionPauseReasons(),
      reducedMotion: this.isReduced(),
      scroll: this.scroll.value,
      layers: this.layers.map((layer) => layer.id),
    };
  }

  // ---------- Холст и слушатели ----------

  private create(): void {
    if (this.canvas || typeof window === "undefined") return;

    const root = document.createElement("div");
    root.className = "motion-stage";
    root.setAttribute("aria-hidden", "true");
    const canvas = document.createElement("canvas");
    canvas.className = "motion-canvas";
    root.appendChild(canvas);
    document.body.appendChild(root);

    const ctx = createContext(canvas);
    if (!ctx) {
      // WebGL нет — движка нет, сайт работает как обычно
      root.remove();
      this.lost = true;
      return;
    }
    this.root = root;
    this.canvas = canvas;
    this.ctx = ctx;
    this.quality = readQuality(sessionStorageOrNull());
    this.sizeDirty = true;

    for (const layer of this.layers) layer.init(ctx.gl);

    this.listen<WebGLContextEvent>(canvas, "webglcontextlost", (event) => {
      // preventDefault: иначе браузер напишет ошибку в консоль
      event.preventDefault();
      this.lost = true;
      this.setQuality(4);
      this.stop();
    });

    const onResize = () => {
      this.sizeDirty = true;
      this.requestFrame();
    };
    this.listen(window, "resize", onResize);
    this.listen(window, "orientationchange", onResize);
    // Safari на iPhone прячет и показывает адресную строку, не трогая
    // window.resize: высота окна меняется, а событие приходит только сюда.
    // Без этого холст остаётся прежнего размера и линии растягиваются.
    if (window.visualViewport) {
      this.listen(window.visualViewport, "resize", onResize);
    }

    this.listen(document, "visibilitychange", () => this.syncHidden());
    this.syncHidden();

    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    this.reduced = media.matches;
    const onMedia = () => {
      this.reduced = media.matches;
      this.updateLoop();
      this.requestFrame();
    };
    media.addEventListener("change", onMedia);
    this.cleanups.push(() => media.removeEventListener("change", onMedia));

    this.cleanups.push(onMotionPauseChange(() => this.updateLoop()));

    if (process.env.NODE_ENV === "development") {
      (
        window as unknown as { __apetitMotion?: () => MotionStats }
      ).__apetitMotion = () => this.stats();
    }

    this.updateLoop();
    this.requestFrame();
  }

  private listen<E extends Event>(
    target: EventTarget,
    type: string,
    handler: (event: E) => void,
  ): void {
    const listener = handler as EventListener;
    target.addEventListener(type, listener);
    this.cleanups.push(() => target.removeEventListener(type, listener));
  }

  private syncHidden(): void {
    const hidden = document.visibilityState === "hidden";
    if (hidden === this.hiddenPaused) return;
    this.hiddenPaused = hidden;
    if (hidden) this.pause(HIDDEN);
    else this.resume(HIDDEN);
  }

  private destroy(): void {
    this.stop();
    if (this.stillRaf) cancelAnimationFrame(this.stillRaf);
    this.stillRaf = 0;
    for (const off of this.cleanups) off();
    this.cleanups = [];
    if (this.hiddenPaused) {
      this.hiddenPaused = false;
      this.resume(HIDDEN);
    }
    const gl = this.ctx?.gl;
    if (gl) {
      for (const layer of this.layers) layer.dispose(gl);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.layers = [];
    this.root?.remove();
    this.root = null;
    this.canvas = null;
    this.ctx = null;
    this.lost = false;
    this.frames = 0;
    this.elapsed = 0;
    this.windowsLeft = MEASURE_WINDOWS;
    this.windowStart = 0;
    this.windowFrames = 0;
    if (process.env.NODE_ENV === "development") {
      delete (window as unknown as { __apetitMotion?: () => MotionStats })
        .__apetitMotion;
    }
  }

  // ---------- Цикл ----------

  private isReduced(): boolean {
    return this.reducedOverride ?? this.reduced;
  }

  private updateLoop(): void {
    const should =
      !!this.ctx &&
      !this.lost &&
      this.layers.length > 0 &&
      !isMotionPaused() &&
      !this.isReduced() &&
      this.quality !== 4;
    if (should === this.running) return;
    if (should) this.start();
    else this.stop();
  }

  private start(): void {
    this.running = true;
    this.last = performance.now();
    this.windowStart = 0;
    this.windowFrames = 0;
    // После паузы фон не «догоняет» прокрутку издалека
    this.scroll.reset(window.scrollY);
    this.raf = requestAnimationFrame(this.loop);
  }

  private stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private loop = (now: number): void => {
    this.raf = requestAnimationFrame(this.loop);
    const minStep = MIN_FRAME_MS[this.quality];
    const dt = now - this.last;
    // 30 кадров/с: половину кадров экрана пропускаем (−1 мс — чтобы не
    // терять кадр из-за округления времени браузером)
    if (minStep > 0 && dt < minStep - 1) return;
    this.last = now;
    this.draw(now, Math.min(dt, MAX_FRAME_MS));
    this.measure(now);
  };

  private draw(now: number, dt: number): void {
    const ctx = this.ctx;
    if (!ctx || this.lost || ctx.gl.isContextLost()) return;
    this.syncSize();
    const reduced = this.isReduced();
    if (!reduced) this.elapsed += dt;
    const scrollY = window.scrollY;
    const frame: Frame = {
      t: reduced ? 0 : this.elapsed / 1000,
      dt,
      width: this.cssWidth,
      height: this.cssHeight,
      dpr: this.dpr,
      scroll: reduced ? 0 : this.scroll.update(scrollY, dt),
      scrollY,
      quality: this.quality,
    };
    const gl = ctx.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    for (const layer of this.layers) layer.render(gl, frame);
    this.frames++;
    // Первый нарисованный кадр — холст проявляется за 300 мс (globals.css)
    if (this.frames === 1 && this.canvas) this.canvas.dataset.ready = "";
  }

  /** Размер холста меряем не каждый кадр, а когда он мог измениться:
   *  getBoundingClientRect заставляет браузер пересчитать раскладку. */
  private syncSize(): void {
    const canvas = this.canvas;
    if (!canvas || !this.sizeDirty) return;
    this.sizeDirty = false;
    const rect = canvas.getBoundingClientRect();
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;
    this.dpr = canvasDpr(window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * this.dpr));
    const height = Math.max(1, Math.round(rect.height * this.dpr));
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    this.ctx?.gl.viewport(0, 0, width, height);
  }

  private measure(now: number): void {
    if (!this.windowStart) {
      this.windowStart = now;
      this.windowFrames = 0;
      return;
    }
    this.windowFrames++;
    const elapsed = now - this.windowStart;
    if (elapsed < MEASURE_WINDOW_MS) return;
    this.fps = Math.round((this.windowFrames * 1000) / elapsed);
    this.windowStart = now;
    this.windowFrames = 0;
    // Первые окна решают уровень; дальше число нужно только панели
    if (this.windowsLeft <= 0 || !shouldMeasure(this.quality)) return;
    this.windowsLeft--;
    const next = nextQuality(this.quality, this.fps);
    if (next !== this.quality) this.setQuality(next);
  }
}

/** Движок один на весь сайт. */
export const engine = new MotionEngine();
