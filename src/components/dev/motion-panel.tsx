"use client";
// Панель настройки движения — /dev/motion. Инструмент Амяна, только в
// разработке: слева ползунки, справа настоящая страница меню Сорок в рамке
// телефона. Любое движение ползунка тут же уходит в страницу сообщением
// (postMessage, только свой адрес) — перезагрузки не нужно.
//
// «Сохранить» переписывает src/config/motion.json через /api/dev/motion;
// после этого Next сам перезагружает страницу в рамке с новыми значениями.
//
// Панель на русском и без системы переводов — так решил архитектор:
// это инструмент разработки, а не часть сайта.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BACKGROUND_RANGES,
  CONTOUR_COLORS,
  type BackgroundSettings,
  type ContourColor,
} from "@/motion/config-schema";
import {
  PANEL_SOURCE,
  STAGE_SOURCE,
  type PanelMessage,
  type StageMessage,
  type StageStats,
} from "@/motion/dev-messages";

/** Что показываем в рамке: обычная страница меню города. */
const PREVIEW_URL = "/soroca";

const QUALITY_NAMES: Record<number, string> = {
  1: "1 — полное",
  2: "2 — плотность 1×",
  3: "3 — 30 кадров/с",
  4: "4 — стоп",
};

const COLOR_NAMES: Record<ContourColor, string> = {
  ash: "Ash",
  smoke: "Smoke",
  sand: "Sand",
};

export function MotionPanel({ saved }: { saved: BackgroundSettings }) {
  const [file, setFile] = useState(saved);
  const [value, setValue] = useState(saved);
  const [reduced, setReduced] = useState(false);
  const [stats, setStats] = useState<StageStats | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const dirty = JSON.stringify(file) !== JSON.stringify(value);

  // Отправить настройки в страницу. Адрес получателя — свой же.
  const send = useCallback(
    (background: BackgroundSettings, reducedMotion: boolean) => {
      const message: PanelMessage = {
        source: PANEL_SOURCE,
        background,
        reducedMotion,
      };
      frameRef.current?.contentWindow?.postMessage(
        message,
        window.location.origin,
      );
    },
    [],
  );

  // Ответы страницы: «я подключилась» (шлём ей текущие значения) и кадры
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as StageMessage | null;
      if (!data || data.source !== STAGE_SOURCE) return;
      if (data.ready) send(value, reduced);
      if (data.stats) setStats(data.stats);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [send, value, reduced]);

  // Любое изменение ползунка — сразу в страницу
  useEffect(() => {
    send(value, reduced);
  }, [send, value, reduced]);

  const set = <K extends keyof BackgroundSettings>(
    key: K,
    next: BackgroundSettings[K],
  ) => setValue((current) => ({ ...current, [key]: next }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/dev/motion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ background: value }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Сервер ответил ${response.status}`);
      }
      setFile(value);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не сохранилось");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-dvh bg-cream text-ink">
      {/* Колонка настроек: заголовок и низ со сводкой всегда на месте,
          прокручиваются только сами ползунки */}
      <aside className="flex h-dvh w-[380px] shrink-0 flex-col border-r border-ink/15">
        <header className="px-6 pt-6">
          <h1 className="font-display text-[28px] leading-none uppercase">
            Движение
          </h1>
          <p className="mt-2 font-body text-meta text-smoke">
            Настройки эффектов сайта. Видно сразу, сохраняются в файл проекта.
          </p>

          {/* Вкладки по разделам src/config/motion.json. Сейчас раздел один —
              следующие эффекты добавят сюда свои. */}
          <nav aria-label="Разделы" className="mt-4">
            <ul className="flex gap-2">
              <li>
                <span
                  aria-current="true"
                  className="inline-flex h-8 items-center rounded-pill bg-ink px-3 font-ui text-chip text-cream"
                >
                  Фон
                </span>
              </li>
            </ul>
          </nav>
        </header>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          <Choice
            label="Режим"
            value={value.mode}
            options={[
              { id: "live", label: "Живые линии" },
              { id: "static", label: "Не двигается" },
            ]}
            onChange={(mode) => set("mode", mode)}
          />

          <Slider
            label="Масштаб рисунка"
            field="scale"
            value={value.scale}
            digits={0}
            onChange={(next) => set("scale", next)}
          />
          <Slider
            label="Толщина"
            field="width"
            value={value.width}
            digits={2}
            onChange={(next) => set("width", next)}
          />
          <Slider
            label="Насыщенность"
            field="opacity"
            value={value.opacity}
            digits={2}
            onChange={(next) => set("opacity", next)}
          />
          <Slider
            label="Скорость"
            field="speed"
            value={value.speed}
            digits={2}
            onChange={(next) => set("speed", next)}
          />
          <Slider
            label="Сдвиг при прокрутке"
            field="parallax"
            value={value.parallax}
            digits={2}
            onChange={(next) => set("parallax", next)}
          />
          <Slider
            label="Инертность"
            field="ease"
            value={value.ease}
            digits={2}
            onChange={(next) => set("ease", next)}
          />

          <Choice
            label="Цвет"
            value={value.color}
            options={(Object.keys(COLOR_NAMES) as ContourColor[]).map((id) => ({
              id,
              label: COLOR_NAMES[id],
              swatch: CONTOUR_COLORS[id],
            }))}
            onChange={(color) => set("color", color)}
          />

          <label className="flex items-center gap-3 font-ui text-label">
            <input
              type="checkbox"
              checked={reduced}
              onChange={(event) => setReduced(event.target.checked)}
              className="size-4 accent-yellow"
            />
            Уменьшить движение
          </label>
        </div>

        <footer className="flex flex-col gap-3 border-t border-ink/15 p-6">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-body text-meta">
            <dt className="text-smoke">Кадров в секунду</dt>
            <dd className="tabular-nums">{stats ? stats.fps : "—"}</dd>
            <dt className="text-smoke">Качество</dt>
            <dd>
              {stats ? (QUALITY_NAMES[stats.quality] ?? stats.quality) : "—"}
            </dd>
            <dt className="text-smoke">Движок</dt>
            <dd>
              {stats
                ? stats.running
                  ? "идёт"
                  : `стоит${stats.paused.length ? ` · ${stats.paused.join(", ")}` : ""}`
                : "—"}
            </dd>
          </dl>

          {error && (
            <p role="alert" className="font-body text-meta text-closed">
              {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="h-11 rounded-pill bg-yellow px-5 font-ui text-label text-ink transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] disabled:opacity-40"
            >
              {saving ? "Сохраняю…" : "Сохранить"}
            </button>
            <button
              type="button"
              onClick={() => setValue(file)}
              disabled={!dirty}
              className="h-11 rounded-pill border border-ink px-5 font-ui text-label transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-40"
            >
              Сбросить к сохранённым
            </button>
          </div>
          <p className="font-body text-meta text-smoke">
            {dirty ? "Есть несохранённые изменения" : "Совпадает с файлом"} ·
            src/config/motion.json
          </p>
        </footer>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        <iframe
          ref={frameRef}
          src={PREVIEW_URL}
          title="Меню Сорок"
          width={390}
          className="h-[min(844px,calc(100dvh-96px))] rounded-tile border border-ink bg-cream"
        />
        <p className="font-body text-meta text-smoke">
          Настоящая страница {PREVIEW_URL}, ширина 390 px
        </p>
      </main>
    </div>
  );
}

/** Ползунок с границами из схемы настроек (src/motion/config-schema.ts). */
function Slider({
  label,
  field,
  value,
  digits,
  onChange,
}: {
  label: string;
  field: keyof typeof BACKGROUND_RANGES;
  value: number;
  digits: number;
  onChange: (value: number) => void;
}) {
  const [min, max, step] = BACKGROUND_RANGES[field];
  return (
    <label className="block">
      <span className="flex items-baseline justify-between font-ui text-label">
        {label}
        <span className="tabular-nums font-body text-meta text-smoke">
          {value.toFixed(digits)}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        aria-label={label}
        className="mt-2 w-full accent-yellow"
      />
      <span className="mt-1 flex justify-between font-body text-[11px] text-ash">
        <span>{min}</span>
        <span>{max}</span>
      </span>
    </label>
  );
}

/** Выбор одного из нескольких: режим, цвет. */
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; swatch?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="font-ui text-label">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.id)}
              className={`inline-flex h-9 items-center gap-2 rounded-pill border border-ink px-4 font-ui text-chip transition-colors duration-150 ease-out ${
                active ? "bg-ink text-cream" : "bg-transparent text-ink"
              }`}
            >
              {option.swatch && (
                <span
                  aria-hidden="true"
                  className="size-3 rounded-pill border border-ink/30"
                  style={{ background: option.swatch }}
                />
              )}
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
