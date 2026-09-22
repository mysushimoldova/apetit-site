// Слова, которыми панель /dev/motion и страница в <iframe> разговаривают
// друг с другом. Отдельный крошечный модуль: панели не нужен сам движок.
import type { QualityLevel } from "./quality";

export const PANEL_SOURCE = "apetit-motion-panel";
export const STAGE_SOURCE = "apetit-motion-stage";

/** Панель → страница: настройки фона, цвет фона страницы и «уменьшить
 *  движение». */
export interface PanelMessage {
  source: typeof PANEL_SOURCE;
  /** Проверяются схемой на стороне страницы, поэтому здесь unknown. */
  background: unknown;
  page: unknown;
  reducedMotion: boolean;
}

export interface StageStats {
  fps: number;
  quality: QualityLevel;
  running: boolean;
  paused: string[];
}

/** Страница → панель: «я подключилась» и кадры в секунду. */
export interface StageMessage {
  source: typeof STAGE_SOURCE;
  ready?: true;
  stats?: StageStats;
}
