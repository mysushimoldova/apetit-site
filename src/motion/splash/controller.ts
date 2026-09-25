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
// Загрузка (решение архитектора 25.09.2026): когда меню показано и страница
// простаивает, ролики и фото всех категорий точки тихо догружаются заранее
// (videos.ts, photos.ts), поэтому заставка играет уже с первого нажатия.
// Нажали раньше, чем блюдо догрузилось, — ждём его не дольше WAIT_MS, потом
// обычный переход без заставки.
//
// Нажатие на другую категорию, пока заставка идёт или уходит: текущая
// обрывается мгновенно, без ухода, и сразу играет заставка новой. С момента
// ухода (касание или конец показа) заставка пропускает касания насквозь —
// лента категорий под ней доступна, не дожидаясь конца затухания.
//
// Заставки НЕ будет (переход к категории обычный, без ошибок в консоли):
//  • настройка выключена;
//  • «уменьшить движение» в системе;
//  • самый низкий уровень качества движка (4 — движок стоит совсем);
//  • экономия трафика (saveData или сеть 2g) — тогда и не грузится ничего;
//  • нет WebGL2 — слой не соберётся;
//  • у категории нет ни ролика, ни фото в меню выбранной точки;
//  • блюдо не успело догрузиться за WAIT_MS после нажатия.
import type { SplashSettings } from "../config-schema";
import { engine } from "../engine";
import { createSplashLayer, type SplashLayer } from "../layers/splash";
import { pauseMotion, resumeMotion } from "../pause";
import {
  SPLASH_VIDEOS,
  splashModeFor,
  splashPrefetchFor,
  splashVideoFor,
  type SplashPhotos,
} from "./catalog";
import { splashRate } from "./geometry";
import { createSplashPhotoPool } from "./photos";
export { setSplashPlayer } from "./request";
import {
  setSplashPlayer,
  type SplashAnswer,
  type SplashRequest,
} from "./request";
import { splashVisual } from "./timeline";
import { createSplashVideoPool } from "./videos";
import { whenPageSettles } from "./wait";
import type { SplashMedia } from "../layers/splash";

/** Причина паузы движка, пока играет заставка (docs/MOTION.md §1). */
export const SPLASH_PAUSE = "splash";

/** Признак на <html>: по нему CSS поднимает холст движка над страницей. */
const SPLASH_ATTR = "data-splash";

/**
 * Сколько нажатие ждёт блюдо, которое ещё догружается (решение архитектора
 * 25.09.2026). Не настройка вида заставки, а правило загрузки: дольше —
 * человек заметит, что нажатие «задумалось».
 */
const WAIT_MS = 150;

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
  play(request: SplashRequest): SplashAnswer;
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

interface BackGuard {
  /** Заставка на экране: «назад» должен закрыть её. */
  arm(): void;
  /** Заставка ушла: убрать свою запись из истории. */
  release(): void;
  dispose(): void;
}

/**
 * Кнопка «назад» во время заставки закрывает её, а не уводит со страницы.
 * Для этого на время заставки в истории лежит одна своя запись, а после
 * ухода она убирается — в итоге заставка в истории браузера не остаётся.
 *
 * Смена одной заставки на другую запись не трогает: она одна на всю череду.
 * Если новая заставка началась, пока свой шаг назад ещё в пути, запись
 * кладётся заново только после него — иначе этот шаг снял бы уже её.
 *
 * На время своей записи браузер не должен сам возвращать прокрутку: иначе
 * после заставки страница уезжает туда, где стояла до перехода к категории.
 */
function createBackGuard(onBack: () => void): BackGuard {
  /** Своя запись лежит сверху. */
  let armed = false;
  /** Свой шаг назад отправлен и ещё не дошёл. */
  let leaving = false;
  /** Заставка сейчас на экране. */
  let wanted = false;
  let disposed = false;
  let restoration: ScrollRestoration = "auto";

  function push(): void {
    restoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    history.pushState(history.state, "");
    armed = true;
  }

  const onPop = () => {
    if (leaving) {
      // Дошёл наш собственный шаг назад. Обычную прокрутку возвращаем
      // только со следующего кадра: Safari восстанавливает положение
      // страницы уже ПОСЛЕ popstate и, увидев "auto", увозил её туда, где
      // она стояла до заставки.
      leaving = false;
      if (disposed) window.removeEventListener("popstate", onPop);
      requestAnimationFrame(() => {
        if (!leaving && !armed) history.scrollRestoration = restoration;
      });
      if (!disposed && wanted) push();
      return;
    }
    if (!armed) return;
    // Человек нажал «назад»: запись уже снята браузером
    armed = false;
    history.scrollRestoration = restoration;
    onBack();
  };
  window.addEventListener("popstate", onPop);

  return {
    arm() {
      wanted = true;
      if (!armed && !leaving) push();
    },
    release() {
      wanted = false;
      if (!armed) return;
      armed = false;
      leaving = true;
      history.back();
    },
    dispose() {
      disposed = true;
      // Свой шаг назад ещё в пути — слушаем до него, чтобы вернуть прокрутку
      if (!leaving) window.removeEventListener("popstate", onPop);
    },
  };
}

export function createSplashController(deps: SplashDeps): SplashController {
  let settings = deps.settings;
  const available = deps.available;
  const dom = buildDom();

  const layer: SplashLayer = createSplashLayer();
  engine.add(layer);

  const pool = createSplashVideoPool(dom.videos);
  const photoPool = createSplashPhotoPool();

  let disposed = false;
  /** Идёт клип заставки: блюдо на экране, считаются кадры. */
  let playing = false;
  /** Страница «под заставкой»: пауза движка, запрет прокрутки, запись в
   *  истории. При смене одной заставки на другую это не снимается. */
  let held = false;
  let raf = 0;
  let startedAt = 0;
  let exitAt = Number.POSITIVE_INFINITY;
  let media: SplashMedia | null = null;
  /** Играем фото, а не ролик: у фото своя распаковка в шейдере. */
  let photo = false;
  /** Номер последней просьбы сыграть. Ответ, опоздавший из-за загрузки,
   *  не должен перебить нажатие, сделанное после него. */
  let asked = 0;

  const blockScroll = (event: Event) => event.preventDefault();
  const guard = createBackGuard(() => end());

  function stopVideo(): void {
    if (!(media instanceof HTMLVideoElement)) return;
    try {
      media.pause();
    } catch {
      // Ролик мог не догрузиться — заставке это не мешает
    }
  }

  /** С этого момента заставка уходит и пропускает касания насквозь:
   *  лента категорий под ней уже доступна. */
  function markLeaving(): void {
    if (!("leaving" in dom.root.dataset)) dom.root.dataset.leaving = "";
  }

  /** Убрать с экрана сам клип: блюдо, круг, кремовый экран, слово. */
  function stopClip(): void {
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
    dom.root.removeAttribute("data-leaving");
    dom.word.removeAttribute("data-on");
  }

  /** Страница уходит «под заставку». Повторный вызов ничего не делает. */
  function hold(): void {
    if (held) return;
    held = true;
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
    // Пока идёт заставка, остальные эффекты движка стоят (docs/MOTION.md §1)
    pauseMotion(SPLASH_PAUSE);
    guard.arm();
  }

  /** Страница снова своя: всё, что поставил hold(), снимается. */
  function release(): void {
    if (!held) return;
    held = false;
    document.documentElement.removeAttribute(SPLASH_ATTR);
    window.removeEventListener("wheel", blockScroll);
    window.removeEventListener("touchmove", blockScroll);
    deps.setLines?.(null);
    resumeMotion(SPLASH_PAUSE);
    guard.release();
    deps.onEnd?.();
  }

  function finish(): void {
    stopClip();
    release();
    engine.requestFrame();
  }

  function frame(now: number): void {
    if (!playing) return;
    raf = requestAnimationFrame(frame);
    const elapsed = now - startedAt;

    // Уход начался — ролик замирает вместе с движением
    if (elapsed >= exitAt) {
      stopVideo();
      markLeaving();
    }

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
    // Идёт другая заставка — обрываем мгновенно, без ухода. Страница при
    // этом остаётся «под заставкой»: новая встаёт на место старой в этом же
    // кадре, и сетка между ними не мелькает.
    if (playing) stopClip();

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
    hold();

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
    markLeaving();
  }

  /** Заставка сейчас вообще возможна (не зависит от категории). */
  function canPlay(): boolean {
    if (disposed || !settings.enabled) return false;
    if (prefersReducedMotion()) return false;
    if (savingData()) return false;
    // Уровень 4 — движок стоит вовсе (слабый телефон): заставки нет
    if (engine.stats().quality >= 4) return false;
    return layer.isSupported();
  }

  /** Новой заставки не будет: идущая обрывается — открывается категория. */
  function refuse(): false {
    if (playing) finish();
    return false;
  }

  function play(request: SplashRequest): SplashAnswer {
    const ticket = ++asked;
    if (!canPlay()) return refuse();

    const mode = splashModeFor(request.category, available, deps.photos);
    if (mode.kind === "none") return refuse();

    const asPhoto = mode.kind === "photo";
    const ready = asPhoto ? photoPool.take(mode.src) : pool.take(mode.slug);
    if (ready) {
      begin(request.word, ready, asPhoto);
      return true;
    }

    // Блюдо ещё догружается — ждём его совсем недолго
    const later = asPhoto
      ? photoPool.wait(mode.src, WAIT_MS)
      : pool.wait(mode.slug, WAIT_MS);
    return later.then((media) => {
      // Пока ждали, нажали другую категорию: решает уже она
      if (ticket !== asked) return false;
      if (!media || !canPlay()) return refuse();
      begin(request.word, media, asPhoto);
      return true;
    });
  }

  // Когда меню показано и страница простаивает — тихо догрузить блюда всех
  // категорий точки. При экономии трафика и там, где заставки не будет
  // вовсе, не грузится ничего.
  const stopPrefetch = whenPageSettles(() => {
    if (!canPlay()) return;
    const plan = splashPrefetchFor(available, deps.photos);
    pool.prefetch(plan.videos);
    photoPool.prefetch(plan.photos);
  });

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
      stopPrefetch();
      if (playing) finish();
      disposed = true;
      guard.dispose();
      dom.root.removeEventListener("pointerdown", onPointer);
      pool.dispose();
      photoPool.dispose();
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
