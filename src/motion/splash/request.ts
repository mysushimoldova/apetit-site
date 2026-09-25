// Мостик между лентой чипов и заставкой.
//
// Отдельный крошечный модуль — по той же причине, что и src/motion/pause.ts:
// чипы категорий не должны тянуть в свой бандл ни WebGL, ни загрузчик
// роликов. Здесь только ссылка на того, кто умеет играть заставку.

export interface SplashRequest {
  /** Слаг категории (kebab, burgers…). */
  category: string;
  /** Название категории на языке страницы — слово на заставке. */
  word: string;
  /** Адрес страницы после заставки (#категория). Своя запись заставки в
   *  истории снимается, и без этого метка ушла бы вместе с ней. Нет —
   *  адрес не трогаем. */
  url?: string;
}

/**
 * true — заставка играет уже сейчас; false — заставки не будет; Promise —
 * блюдо ещё догружается, решение придёт не позже чем через 150 мс.
 */
export type SplashAnswer = boolean | Promise<boolean>;

export type SplashPlayer = (request: SplashRequest) => SplashAnswer;

let player: SplashPlayer | null = null;

/** Заставка подключилась к странице. Возвращает отключение. */
export function setSplashPlayer(next: SplashPlayer): () => void {
  player = next;
  return () => {
    if (player === next) player = null;
  };
}

/**
 * Попросить заставку сыграть. true — играет (переход к категории делаем
 * мгновенно, под ней), false — заставки нет: обычный плавный переход.
 * Promise — ответ чуть позже: блюдо догружается (не дольше 150 мс).
 */
export function requestSplash(request: SplashRequest): SplashAnswer {
  return player ? player(request) : false;
}

let warmer: (() => void) | null = null;

/** Заставка готова заранее собрать своё для видеокарты. Возвращает
 *  отключение. */
export function setSplashWarmer(next: () => void): () => void {
  warmer = next;
  return () => {
    if (warmer === next) warmer = null;
  };
}

/**
 * Палец только коснулся чипа (pointerdown): заставка собирает программы
 * видеокарты, пока палец ещё не отпущен (решение архитектора 25.09.2026).
 * Тогда само нажатие (click) их уже не ждёт. Заставки не будет — ничего не
 * делает.
 */
export function warmSplash(): void {
  warmer?.();
}
