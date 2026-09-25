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
