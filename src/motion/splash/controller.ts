// Заставка категории целиком: когда играть, что показывать, когда уйти.
//
// Делится так: числа — в timeline.ts и geometry.ts (их проверяют тесты),
// рисование блюда и круга — слой src/motion/layers/splash.ts, а здесь
// собственный DOM заставки (кремовый экран и слово категории),
// ролики и весь порядок действий.
//
// Заставки НЕ будет (переход к категории обычный, без ошибок в консоли):
//  • настройка выключена;
//  • «уменьшить движение» в системе;
//  • самый низкий уровень качества движка (4 — движок стоит совсем);
//  • экономия трафика (saveData или сеть 2g);
//  • нет WebGL2 — слой не соберётся;
//  • у категории нет роликов или их нет в меню выбранной точки;
//  • ролики ещё не загружены: первое нажатие ставит их в загрузку.
import type { SplashSettings } from "../config-schema";
import { engine } from "../engine";
import { createSplashLayer, type SplashLayer } from "../layers/splash";
import { pauseMotion, resumeMotion } from "../pause";
import { SPLASH_VIDEOS, splashVideosFor } from "./catalog";
import { splashRate, splashSwitchTimes } from "./geometry";
export { setSplashPlayer } from "./request";
import { setSplashPlayer, type SplashRequest } from "./request";
import { splashVisual } from "./timeline";

/** Причина паузы движка, пока играет заставка (docs/MOTION.md §1). */
export const SPLASH_PAUSE = "splash";

/** Признак на <html>: по нему CSS поднимает холст движка над страницей. */
const SPLASH_ATTR = "data-splash";

/** Смена блюда: уходящее сжимается, приходящее растёт (эталон). */
const SWITCH_FROM = 0.86;

export interface SplashDeps {
  settings: SplashSettings;
  /** Слаги блюд, которые есть в меню выбранной точки. */
  available: ReadonlySet<string>;
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
  let poolModule: typeof import("./videos") | null = null;
  // Загрузчик роликов подтягивается отдельным куском кода — при открытии
  // сайта он не нужен вовсе
  void import("./videos").then((module) => {
    poolModule = module;
    if (!disposed) pool = module.createSplashVideoPool(dom.videos);
  });

  let disposed = false;
  let playing = false;
  let raf = 0;
  let startedAt = 0;
  let exitAt = Number.POSITIVE_INFINITY;
  let videos: HTMLVideoElement[] = [];
  let switchAt: number[] = [];
  let switching: { from: number; started: number } | null = null;
  let current = 0;
  let popGuard: (() => void) | null = null;
  let lockRaf = 0;

  const blockScroll = (event: Event) => event.preventDefault();

  function stopVideos(): void {
    for (const video of videos) {
      try {
        video.pause();
        video.currentTime = 0;
      } catch {
        // Ролик мог не догрузиться — заставке это не мешает
      }
    }
  }

  function finish(): void {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    stopVideos();
    videos = [];
    switching = null;
    layer.setDraw(null);
    dom.root.removeAttribute("data-on");
    dom.word.removeAttribute("data-on");
    if (lockRaf) cancelAnimationFrame(lockRaf);
    lockRaf = 0;
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

    // Смена блюда по расписанию (если в настройках их два)
    if (!switching && switchAt.length && elapsed >= switchAt[0]) {
      switchAt.shift();
      if (videos.length > 1) switching = { from: current, started: now };
    }
    let mix = 0;
    let scaleA = 1;
    let scaleB = 1;
    if (switching) {
      mix = Math.min(
        1,
        (now - switching.started) / Math.max(1, settings.xfade),
      );
      if (mix >= 1) {
        current = current === 0 ? 1 : 0;
        switching = null;
        mix = 0;
      } else {
        scaleA = 1 - Math.pow(mix, 1.6);
        scaleB = SWITCH_FROM + (1 - SWITCH_FROM) * (1 - Math.pow(1 - mix, 2));
      }
    }

    const visual = splashVisual(elapsed, settings.hold, settings, exitAt);
    // Экран, слово и блюдо уезжают вверх одним движением: доля одна и та же
    const lift = `${-visual.liftShare * 101}%`;
    dom.root.style.setProperty("--splash-lift", lift);
    dom.word.style.setProperty(
      "--splash-lift-px",
      `${-visual.liftShare * window.innerHeight}px`,
    );
    dom.root.style.setProperty(
      "--splash-screen-alpha",
      String(settings.exit === "fade" ? visual.foodAlpha : 1),
    );
    dom.word.style.setProperty("--splash-word-alpha", String(visual.foodAlpha));
    layer.setDraw({
      ...visual,
      videos: switching
        ? [videos[switching.from], videos[switching.from === 0 ? 1 : 0]]
        : [videos[current]],
      mix,
      scaleA,
      scaleB,
      zoom: settings.zoom,
      disc: settings.disc,
    });
    // Если цикл движка идёт, он нарисует сам; если стоит — рисуем кадр сами
    engine.requestFrame();
    if (!visual.visible) finish();
  }

  function begin(word: string, ready: HTMLVideoElement[]): void {
    playing = true;
    videos = ready;
    current = 0;
    switching = null;
    switchAt = splashSwitchTimes(settings.hold, ready.length);
    exitAt = settings.hold;
    startedAt = performance.now();

    dom.word.textContent = word;
    dom.word.style.setProperty("--splash-word-y", `${settings.wordY}px`);
    if (settings.wordTop) dom.word.dataset.wordTop = "";
    else delete dom.word.dataset.wordTop;
    if (settings.word) dom.word.dataset.on = "";
    else dom.word.removeAttribute("data-on");
    dom.root.dataset.on = "";
    // Замок прокрутки — со следующего кадра: ровно сейчас лента чипов ещё
    // переводит страницу к выбранной категории (мгновенно, под заставкой),
    // а при overflow: hidden этот переход бы не сработал.
    lockRaf = requestAnimationFrame(() => {
      lockRaf = 0;
      if (playing) document.documentElement.setAttribute(SPLASH_ATTR, "");
    });
    // Пока заставка на экране, страница не прокручивается. Именно
    // событиями, а не overflow: hidden на <html>: тот снимается вместе с
    // положением прокрутки, и страница уезжала бы обратно наверх.
    window.addEventListener("wheel", blockScroll, { passive: false });
    window.addEventListener("touchmove", blockScroll, { passive: false });
    // Линии фона на заставке приглушены до своей настройки
    deps.setLines?.(settings.lines);

    const rate = splashRate(settings.hold);
    for (const video of ready) {
      try {
        video.currentTime = 0;
        video.playbackRate = rate;
        void video.play();
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

    raf = requestAnimationFrame(frame);
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

    const slugs = splashVideosFor(request.category, available, settings.count);
    if (slugs.length === 0) return false;
    if (!pool) {
      // Загрузчик ещё не подтянулся — в следующий раз
      void poolModule;
      return false;
    }
    const ready = pool.take(slugs);
    if (!ready) return false; // грузится: заставка будет со следующего раза
    begin(request.word, ready);
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
 * Первая категория, у которой есть ролики и блюда в этом меню. Нужна только
 * кнопке «Проиграть» в панели /dev/motion.
 */
export function firstSplashCategory(
  available: ReadonlySet<string>,
): SplashRequest | null {
  for (const category of Object.keys(SPLASH_VIDEOS)) {
    if (splashVideosFor(category, available, 1).length > 0) {
      return { category, word: category };
    }
  }
  return null;
}
