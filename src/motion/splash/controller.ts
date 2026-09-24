// Заставка категории целиком: когда играть, что показывать, когда уйти.
//
// Делится так: числа — в timeline.ts и geometry.ts (их проверяют тесты),
// рисование блюда и круга — слой src/motion/layers/splash.ts, а здесь
// собственный DOM заставки (кремовый экран и слово категории),
// ролик и весь порядок действий.
//
// Заставка есть у каждой категории и показывает ОДНО блюдо: где снят ролик —
// играет ролик, где нет — та же заставка с вырезанным фото того же блюда.
//
// Ролик просто играет от начала до конца со скоростью 1000 / hold: кривая
// поворота вшита в файл (60 кадров = 1.0 с). Никаких перемоток и подгонки
// скорости по ходу — поверх ролика считаются только размер, высота и круг.
//
// Заставки НЕ будет (переход к категории обычный, без ошибок в консоли):
//  • настройка выключена;
//  • «уменьшить движение» в системе;
//  • самый низкий уровень качества движка (4 — движок стоит совсем);
//  • экономия трафика (saveData или сеть 2g);
//  • нет WebGL2 — слой не соберётся;
//  • у категории нет ни ролика, ни фото в меню выбранной точки;
//  • ролик или фото ещё не загружены: первое нажатие ставит их в загрузку.
import type { SplashSettings } from "../config-schema";
import { engine } from "../engine";
import { createSplashLayer, type SplashLayer } from "../layers/splash";
import { pauseMotion, resumeMotion } from "../pause";
import {
  SPLASH_VIDEOS,
  splashModeFor,
  splashVideoFor,
  type SplashPhotos,
} from "./catalog";
import { splashRate } from "./geometry";
export { setSplashPlayer } from "./request";
import { setSplashPlayer, type SplashRequest } from "./request";
import { splashVisual } from "./timeline";
import type { SplashMedia } from "../layers/splash";

/** Причина паузы движка, пока играет заставка (docs/MOTION.md §1). */
export const SPLASH_PAUSE = "splash";

/** Признак на <html>: по нему CSS поднимает холст движка над страницей. */
const SPLASH_ATTR = "data-splash";

export interface SplashDeps {
  settings: SplashSettings;
  /** Слаги блюд, которые есть в меню выбранной точки. */
  available: ReadonlySet<string>;
  /** Адреса фото по категориям — для категорий без ролика. */
  photos?: SplashPhotos;
  /** Заставка ушла — сетка уже на месте (карточки не анимируются). */
  onEnd?: () => void;
  /** Насыщенность линий фона на время заставки; null — вернуть свою. */
  setLines?: (opacity: number | null) => void;
}

export interface SplashController {
  play(request: SplashRequest): boolean;
  end(): void;
  isPlaying(): boolean;
  setSettings(next: SplashSettings): void;
  dispose(): void;
}

interface Dom {
  /** Кремовый экран заставки. */
  root: HTMLElement;
  /** Слово категории — отдельным элементом: внутри .splash оно не смогло бы
   *  оказаться поверх холста с блюдом (см. globals.css). */
  word: HTMLElement;
  /** Невидимый уголок, где живут <video>: кадры берёт видеокарта. */
  videos: HTMLElement;
}

function buildDom(): Dom {
  const root = document.createElement("div");
  root.className = "splash";
  root.setAttribute("aria-hidden", "true");
  const videos = document.createElement("i");
  videos.className = "splash-videos";
  root.append(videos);
  const word = document.createElement("i");
  word.className = "splash-word";
  word.setAttribute("aria-hidden", "true");
  document.body.append(root, word);
  return { root, word, videos };
}

/** Экономия трафика: заставка весит сотни килобайт, в таком режиме её нет. */
function savingData(): boolean {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (!connection) return false;
  if (connection.saveData) return true;
  const type = connection.effectiveType ?? "";
  return type === "2g" || type === "slow-2g";
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function createSplashController(deps: SplashDeps): SplashController {
  let settings = deps.settings;
  const available = deps.available;
  const dom = buildDom();

  const layer: SplashLayer = createSplashLayer();
  engine.add(layer);

  let pool: import("./videos").SplashVideoPool | null = null;
  // Загрузчик роликов подтягивается отдельным куском кода — при открытии
  // сайта он не нужен вовсе
  void import("./videos").then((module) => {
    if (!disposed) pool = module.createSplashVideoPool(dom.videos);
  });

  // То же самое для фото: свой маленький загрузчик, тоже отдельным куском
  let photoPool: import("./photos").SplashPhotoPool | null = null;
  void import("./photos").then((module) => {
    if (!disposed) photoPool = module.createSplashPhotoPool();
  });

  let disposed = false;
  let playing = false;
  let raf = 0;
  let startedAt = 0;
  let exitAt = Number.POSITIVE_INFINITY;
  let media: SplashMedia | null = null;
  /** Играем фото, а не ролик: у фото своя распаковка в шейдере. */
  let photo = false;
  let popGuard: (() => void) | null = null;

  const blockScroll = (event: Event) => event.preventDefault();

  function stopVideo(): void {
    if (!(media instanceof HTMLVideoElement)) return;
    try {
      media.pause();
    } catch {
      // Ролик мог не догрузиться — заставке это не мешает
    }
  }

  function finish(): void {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    stopVideo();
    if (media instanceof HTMLVideoElement) {
      try {
        media.currentTime = 0;
      } catch {
        // Не перемоталось — в следующий раз перемотаем перед показом
      }
    }
    media = null;
    photo = false;
    layer.setDraw(null);
    dom.root.removeAttribute("data-on");
    dom.word.removeAttribute("data-on");
    document.documentElement.removeAttribute(SPLASH_ATTR);
    window.removeEventListener("wheel", blockScroll);
    window.removeEventListener("touchmove", blockScroll);
    deps.setLines?.(null);
    resumeMotion(SPLASH_PAUSE);
    popGuard?.();
    popGuard = null;
    engine.requestFrame();
    deps.onEnd?.();
  }

  function frame(now: number): void {
    if (!playing) return;
    raf = requestAnimationFrame(frame);
    const elapsed = now - startedAt;

    // Уход начался — ролик замирает вместе с движением
    if (elapsed >= exitAt) stopVideo();

    const visual = splashVisual(elapsed, settings, exitAt);
    // Экран, слово и блюдо уезжают вверх одним движением: доля одна и та же
    dom.root.style.setProperty("--splash-lift", `${-visual.liftShare * 101}%`);
    dom.word.style.setProperty(
      "--splash-lift-px",
      `${-visual.liftShare * window.innerHeight}px`,
    );
    dom.root.style.setProperty(
      "--splash-screen-alpha",
      String(visual.screenAlpha),
    );
    dom.word.style.setProperty("--splash-word-alpha", String(visual.alpha));
    layer.setDraw({ ...visual, media, photo });
    // Если цикл движка идёт, он нарисует сам; если стоит — рисуем кадр сами
    engine.requestFrame();
    if (!visual.visible) finish();
  }

  function begin(word: string, ready: SplashMedia, asPhoto: boolean): void {
    playing = true;
    media = ready;
    photo = asPhoto;
    exitAt = settings.hold;
    startedAt = performance.now();

    dom.word.textContent = word;
    dom.word.style.setProperty("--splash-word-y", `${settings.wordY}px`);
    if (settings.wordTop) dom.word.dataset.wordTop = "";
    else delete dom.word.dataset.wordTop;
    dom.word.dataset.on = "";
    dom.root.dataset.on = "";
    // Холст движка поднимается над кремовым экраном сразу, в этом же кадре.
    // Раньше признак ставился со следующего кадра — и ровно один кадр
    // человек видел пустой кремовый экран: круг и блюдо уже рисовались, но
    // холст ещё лежал под экраном заставки. Ничего, кроме z-index холста,
    // этот признак не меняет (globals.css), поэтому ждать нечего.
    document.documentElement.setAttribute(SPLASH_ATTR, "");
    // Пока заставка на экране, страница не прокручивается. Именно
    // событиями, а не overflow: hidden на <html>: тот снимается вместе с
    // положением прокрутки, и страница уезжала бы обратно наверх.
    window.addEventListener("wheel", blockScroll, { passive: false });
    window.addEventListener("touchmove", blockScroll, { passive: false });
    // Линии фона на заставке приглушены до своей настройки
    deps.setLines?.(settings.lines);

    if (ready instanceof HTMLVideoElement) {
      try {
        // Перемотка только если ролик и правда не в начале. Присвоение
        // currentTime = 0 уже стоящему на нуле ролику всё равно запускает
        // перемотку, а на время перемотки браузер перестаёт отдавать кадры
        // видеокарте — и первые кадры заставки выходили пустыми.
        if (ready.currentTime > 0) ready.currentTime = 0;
        ready.playbackRate = splashRate(settings.hold);
        void ready.play();
      } catch {
        // Не дали играть — заставка просто покажет первый кадр
      }
    }

    // Пока идёт заставка, остальные эффекты движка стоят (docs/MOTION.md §1)
    pauseMotion(SPLASH_PAUSE);

    // Кнопка «назад» во время заставки закрывает её, а не уводит со страницы.
    // На время нашей записи в истории браузер не должен сам возвращать
    // прокрутку: иначе после заставки страница уезжает туда, где стояла до
    // перехода к категории.
    let self = false;
    const restoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    history.pushState(history.state, "");
    const onPop = () => {
      if (self) return;
      self = true;
      end();
    };
    window.addEventListener("popstate", onPop);
    popGuard = () => {
      window.removeEventListener("popstate", onPop);
      const done = () => {
        history.scrollRestoration = restoration;
      };
      if (self) {
        done();
        return;
      }
      self = true;
      history.back();
      // Вернуть обычное поведение, когда шаг назад уже сделан
      requestAnimationFrame(done);
    };

    // Первый кадр считаем прямо сейчас, не дожидаясь следующего: нажатие на
    // чип и появление круга с блюдом должны попасть в одну и ту же отрисовку
    // экрана. Отсюда же встаёт и обычный ход кадров — frame() сам просит
    // следующий.
    frame(startedAt);
  }

  function end(): void {
    if (!playing) return;
    if (!settings.skip && exitAt === settings.hold) {
      // Касание прерывать не должно, а «назад» и уход со страницы — должны
      const elapsed = performance.now() - startedAt;
      if (elapsed < settings.hold) return;
    }
    const elapsed = performance.now() - startedAt;
    if (elapsed < exitAt) exitAt = elapsed;
  }

  function play(request: SplashRequest): boolean {
    if (disposed || playing) return false;
    if (!settings.enabled) return false;
    if (prefersReducedMotion()) return false;
    if (savingData()) return false;
    // Уровень 4 — движок стоит вовсе (слабый телефон): заставки нет
    if (engine.stats().quality >= 4) return false;
    if (!layer.isSupported()) return false;

    const mode = splashModeFor(request.category, available, deps.photos);
    if (mode.kind === "none") return false;

    if (mode.kind === "video") {
      // Загрузчик ещё не подтянулся — заставка будет со следующего раза
      if (!pool) return false;
      const ready = pool.take(mode.slug);
      if (!ready) return false; // грузится: заставка будет со следующего раза
      begin(request.word, ready, false);
      return true;
    }

    if (!photoPool) return false;
    const image = photoPool.take(mode.src);
    if (!image) return false; // грузится: заставка будет со следующего раза
    begin(request.word, image, true);
    return true;
  }

  const onPointer = () => {
    if (settings.skip) end();
  };
  dom.root.addEventListener("pointerdown", onPointer);

  return {
    play,
    end,
    isPlaying: () => playing,
    setSettings(next) {
      settings = next;
    },
    dispose() {
      disposed = true;
      if (playing) finish();
      dom.root.removeEventListener("pointerdown", onPointer);
      pool?.dispose();
      pool = null;
      photoPool?.dispose();
      photoPool = null;
      engine.remove(layer.id);
      dom.root.remove();
      dom.word.remove();
    },
  };
}

/** Подключить заставку к странице меню: возвращает отключение. */
export function mountSplash(deps: SplashDeps): () => void {
  const controller = createSplashController(deps);
  const unset = setSplashPlayer(controller.play);
  return () => {
    unset();
    controller.dispose();
  };
}

/**
 * Первая категория, у которой есть ролик и блюдо в этом меню. Нужна только
 * кнопке «Проиграть» в панели /dev/motion.
 */
export function firstSplashCategory(
  available: ReadonlySet<string>,
): SplashRequest | null {
  for (const category of Object.keys(SPLASH_VIDEOS)) {
    if (splashVideoFor(category, available)) {
      return { category, word: category };
    }
  }
  return null;
}
