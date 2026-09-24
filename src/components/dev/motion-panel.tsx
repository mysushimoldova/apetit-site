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
  PAGE_BACKGROUNDS,
  PRODUCTS_RANGES,
  SPLASH_DISC_RANGES,
  SPLASH_DISH_RANGES,
  SPLASH_RANGES,
  type BackgroundSettings,
  type ContourColor,
  type MotionConfig,
  type PageBackground,
  type ProductLiftSettings,
  type ProductRevealSettings,
  type ProductShadowSettings,
  type SplashDiscSettings,
  type SplashDishSettings,
  type SplashSettings,
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

const REVEAL_NAMES: Record<ProductRevealSettings["type"], string> = {
  lift: "Выезжает",
  scale: "Подрастает",
  none: "Только проявление",
};

type Tab = "background" | "products" | "splash";

const TABS: { id: Tab; label: string }[] = [
  { id: "background", label: "Фон" },
  { id: "products", label: "Produse" },
  { id: "splash", label: "Ecran categorie" },
];

const EXIT_NAMES: Record<SplashSettings["exit"], string> = {
  fade: "Затухание",
  lift: "Шторка вверх",
  zoom: "Уезжает в меню",
};

/** Строка значений заставки — как кнопка «Copiază» в эталоне
 *  docs/motion/splash-demo.html. */
function splashLine(config: MotionConfig): string {
  const s = config.splash;
  const { dish, disc } = s;
  return (
    `hold=${s.hold} z0=${dish.z0} z1=${dish.z1} y0=${dish.y0} y1=${dish.y1}` +
    ` start=${dish.start} soft=${dish.soft} fin=${s.fin} fout=${s.fout}` +
    ` exit=${s.exit} | disc: d0=${disc.d0} d1=${disc.d1} dstart=${disc.dstart}` +
    ` dsoft=${disc.dsoft} delay=${disc.delay} discY=${disc.y}` +
    ` | wordY=${s.wordY} lines=${s.lines} wordTop=${s.wordTop} skip=${s.skip}` +
    ` enabled=${s.enabled}`
  );
}

/** Строка значений для архитектора — тот же формат, что в демо
 *  docs/motion/produse-demo.html (кнопка «Copiază»). */
function productsLine(config: MotionConfig): string {
  const { shadow, reveal, lift } = config.products;
  const effect = lift.enabled
    ? `efect=land intensitate=${lift.amt} netezime=${lift.smooth} umbraReactie=${lift.shadowReact} ridicare=${lift.rise} sensibilitate=${lift.sensitivity} coborare=${lift.settle} marire=${lift.grow} inclinare=${lift.tilt}`
    : "efect=none";
  return (
    `${effect} || aparitie=${reveal.type} dur=${reveal.dur} dist=${reveal.dist}` +
    ` stagger=${reveal.stagger} shadowDelay=${reveal.shadowDelay}` +
    ` || umbra: aw=${shadow.aw} ah=${shadow.ah} ab=${shadow.ab} aa=${shadow.aa}` +
    ` cw=${shadow.cw} ch=${shadow.ch} cb=${shadow.cb} ca=${shadow.ca}` +
    ` y=${shadow.y} tint=${shadow.tint}`
  );
}

export function MotionPanel({ saved }: { saved: MotionConfig }) {
  const [file, setFile] = useState(saved);
  const [value, setValue] = useState(saved);
  const [tab, setTab] = useState<Tab>("background");
  const [reduced, setReduced] = useState(false);
  const [stats, setStats] = useState<StageStats | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const dirty = JSON.stringify(file) !== JSON.stringify(value);

  // Отправить настройки в страницу. Адрес получателя — свой же.
  const send = useCallback(
    (config: MotionConfig, reducedMotion: boolean, play?: "splash") => {
      const message: PanelMessage = {
        source: PANEL_SOURCE,
        background: config.background,
        products: config.products,
        splash: config.splash,
        page: config.page,
        reducedMotion,
        play,
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
  ) =>
    setValue((current) => ({
      ...current,
      background: { ...current.background, [key]: next },
    }));

  const setShadow = <K extends keyof ProductShadowSettings>(
    key: K,
    next: ProductShadowSettings[K],
  ) =>
    setValue((current) => ({
      ...current,
      products: {
        ...current.products,
        shadow: { ...current.products.shadow, [key]: next },
      },
    }));

  const setReveal = <K extends keyof ProductRevealSettings>(
    key: K,
    next: ProductRevealSettings[K],
  ) =>
    setValue((current) => ({
      ...current,
      products: {
        ...current.products,
        reveal: { ...current.products.reveal, [key]: next },
      },
    }));

  const setLift = <K extends keyof ProductLiftSettings>(
    key: K,
    next: ProductLiftSettings[K],
  ) =>
    setValue((current) => ({
      ...current,
      products: {
        ...current.products,
        lift: { ...current.products.lift, [key]: next },
      },
    }));

  const setSplash = <K extends keyof SplashSettings>(
    key: K,
    next: SplashSettings[K],
  ) =>
    setValue((current) => ({
      ...current,
      splash: { ...current.splash, [key]: next },
    }));

  const setDish = <K extends keyof SplashDishSettings>(
    key: K,
    next: SplashDishSettings[K],
  ) =>
    setValue((current) => ({
      ...current,
      splash: {
        ...current.splash,
        dish: { ...current.splash.dish, [key]: next },
      },
    }));

  const setDisc = <K extends keyof SplashDiscSettings>(
    key: K,
    next: SplashDiscSettings[K],
  ) =>
    setValue((current) => ({
      ...current,
      splash: {
        ...current.splash,
        disc: { ...current.splash.disc, [key]: next },
      },
    }));

  const setPageBackground = (background: PageBackground) =>
    setValue((current) => ({ ...current, page: { background } }));

  const copyLine = async () => {
    const line = tab === "splash" ? splashLine(value) : productsLine(value);
    try {
      await navigator.clipboard.writeText(line);
    } catch {
      // Буфер закрыт настройками браузера — строку видно и так, ниже
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/dev/motion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(value),
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

          {/* Вкладки по разделам src/config/motion.json */}
          <nav aria-label="Разделы" className="mt-4">
            <ul className="flex gap-2">
              {TABS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={tab === item.id ? "true" : undefined}
                    onClick={() => setTab(item.id)}
                    className={`inline-flex h-8 items-center rounded-pill px-3 font-ui text-chip transition-colors duration-150 ease-out ${
                      tab === item.id
                        ? "bg-ink text-cream"
                        : "border border-ink text-ink"
                    }`}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          {tab === "splash" ? (
            <>
              <Toggle
                label="Заставка включена"
                checked={value.splash.enabled}
                onChange={(next) => setSplash("enabled", next)}
              />

              <p className="font-ui text-label text-smoke">Время и мягкость</p>
              <Slider
                label="Длительность"
                hint="мс, от нажатия до ухода; ролик играет со скоростью 1000 / длительность"
                range={SPLASH_RANGES.hold}
                value={value.splash.hold}
                digits={0}
                onChange={(next) => setSplash("hold", next)}
              />
              <Slider
                label="Замедление к концу"
                range={SPLASH_DISH_RANGES.soft}
                value={value.splash.dish.soft}
                digits={2}
                onChange={(next) => setDish("soft", next)}
              />
              <Slider
                label="Плавный старт"
                range={SPLASH_DISH_RANGES.start}
                value={value.splash.dish.start}
                digits={2}
                onChange={(next) => setDish("start", next)}
              />
              <Slider
                label="Появление"
                hint="мс"
                range={SPLASH_RANGES.fin}
                value={value.splash.fin}
                digits={0}
                onChange={(next) => setSplash("fin", next)}
              />
              <Slider
                label="Уход"
                hint="мс"
                range={SPLASH_RANGES.fout}
                value={value.splash.fout}
                digits={0}
                onChange={(next) => setSplash("fout", next)}
              />
              <Choice
                label="Уход заставки"
                value={value.splash.exit}
                options={(
                  Object.keys(EXIT_NAMES) as SplashSettings["exit"][]
                ).map((id) => ({ id, label: EXIT_NAMES[id] }))}
                onChange={(exit) => setSplash("exit", exit)}
              />

              <p className="font-ui text-label text-smoke">
                Размер — в начале большой, в конце меньше
              </p>
              <Slider
                label="Размер в начале"
                range={SPLASH_DISH_RANGES.z0}
                value={value.splash.dish.z0}
                digits={2}
                onChange={(next) => setDish("z0", next)}
              />
              <Slider
                label="Размер в конце"
                range={SPLASH_DISH_RANGES.z1}
                value={value.splash.dish.z1}
                digits={2}
                onChange={(next) => setDish("z1", next)}
              />
              <Slider
                label="Высота в начале"
                hint="px, плюс — ниже середины"
                range={SPLASH_DISH_RANGES.y0}
                value={value.splash.dish.y0}
                digits={0}
                onChange={(next) => setDish("y0", next)}
              />
              <Slider
                label="Высота в конце"
                hint="px"
                range={SPLASH_DISH_RANGES.y1}
                value={value.splash.dish.y1}
                digits={0}
                onChange={(next) => setDish("y1", next)}
              />

              <p className="font-ui text-label text-smoke">
                Жёлтый круг — свой размер и свой разгон
              </p>
              <Slider
                label="Круг в начале"
                hint="доля ширины экрана, 0 — круга нет"
                range={SPLASH_DISC_RANGES.d0}
                value={value.splash.disc.d0}
                digits={2}
                onChange={(next) => setDisc("d0", next)}
              />
              <Slider
                label="Круг в конце"
                hint="доля ширины экрана"
                range={SPLASH_DISC_RANGES.d1}
                value={value.splash.disc.d1}
                digits={2}
                onChange={(next) => setDisc("d1", next)}
              />
              <Slider
                label="Круг: замедление к концу"
                range={SPLASH_DISC_RANGES.dsoft}
                value={value.splash.disc.dsoft}
                digits={2}
                onChange={(next) => setDisc("dsoft", next)}
              />
              <Slider
                label="Круг: плавный старт"
                range={SPLASH_DISC_RANGES.dstart}
                value={value.splash.disc.dstart}
                digits={2}
                onChange={(next) => setDisc("dstart", next)}
              />
              <Slider
                label="Круг: начинает позже"
                hint="доля времени заставки: 0.20 — на пятой части"
                range={SPLASH_DISC_RANGES.delay}
                value={value.splash.disc.delay}
                digits={2}
                onChange={(next) => setDisc("delay", next)}
              />
              <Slider
                label="Круг выше / ниже"
                hint="px"
                range={SPLASH_DISC_RANGES.y}
                value={value.splash.disc.y}
                digits={0}
                onChange={(next) => setDisc("y", next)}
              />

              <p className="font-ui text-label text-smoke">Сцена</p>
              <Slider
                label="Слово выше / ниже"
                hint="px"
                range={SPLASH_RANGES.wordY}
                value={value.splash.wordY}
                digits={0}
                onChange={(next) => setSplash("wordY", next)}
              />
              <Slider
                label="Линии"
                range={SPLASH_RANGES.lines}
                value={value.splash.lines}
                digits={2}
                onChange={(next) => setSplash("lines", next)}
              />
              <Toggle
                label="Слово поверх блюда"
                checked={value.splash.wordTop}
                onChange={(next) => setSplash("wordTop", next)}
              />
              <Toggle
                label="Можно прервать касанием"
                checked={value.splash.skip}
                onChange={(next) => setSplash("skip", next)}
              />

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => send(value, reduced, "splash")}
                  className="h-10 rounded-pill bg-yellow px-4 font-ui text-label transition-transform duration-150 ease-out active:scale-[0.97]"
                >
                  Проиграть
                </button>
                <button
                  type="button"
                  onClick={copyLine}
                  className="h-10 rounded-pill border border-ink px-4 font-ui text-label transition-transform duration-150 ease-out active:scale-[0.97]"
                >
                  {copied ? "Скопировано" : "Copiază"}
                </button>
                <p className="font-mono text-[11px] leading-relaxed break-all text-smoke select-all">
                  {splashLine(value)}
                </p>
              </div>
            </>
          ) : tab === "background" ? (
            <>
              <Choice
                label="Фон страницы"
                value={value.page.background}
                options={(
                  Object.keys(PAGE_BACKGROUNDS) as PageBackground[]
                ).map((id) => ({
                  id,
                  label: `${PAGE_BACKGROUNDS[id]} ${id}`,
                  swatch: id,
                }))}
                onChange={setPageBackground}
              />
              <Choice
                label="Режим"
                value={value.background.mode}
                options={[
                  { id: "live", label: "Живые линии" },
                  { id: "static", label: "Не двигается" },
                ]}
                onChange={(mode) => set("mode", mode)}
              />

              <Slider
                label="Плотность рисунка"
                hint="сколько раз рисунок помещается по ширине экрана"
                range={BACKGROUND_RANGES.tilesAcross}
                value={value.background.tilesAcross}
                digits={2}
                onChange={(next) => set("tilesAcross", next)}
              />
              <Slider
                label="Толщина"
                hint="полутолщина линии в пикселях экрана"
                range={BACKGROUND_RANGES.width}
                value={value.background.width}
                digits={2}
                onChange={(next) => set("width", next)}
              />
              <Slider
                label="Насыщенность"
                range={BACKGROUND_RANGES.opacity}
                value={value.background.opacity}
                digits={2}
                onChange={(next) => set("opacity", next)}
              />
              <Slider
                label="Скорость"
                range={BACKGROUND_RANGES.speed}
                value={value.background.speed}
                digits={2}
                onChange={(next) => set("speed", next)}
              />
              <Slider
                label="Сдвиг при прокрутке"
                range={BACKGROUND_RANGES.parallax}
                value={value.background.parallax}
                digits={2}
                onChange={(next) => set("parallax", next)}
              />
              <Slider
                label="Инертность"
                range={BACKGROUND_RANGES.ease}
                value={value.background.ease}
                digits={2}
                onChange={(next) => set("ease", next)}
              />

              <Choice
                label="Цвет линий"
                value={value.background.color}
                options={(Object.keys(COLOR_NAMES) as ContourColor[]).map(
                  (id) => ({
                    id,
                    label: COLOR_NAMES[id],
                    swatch: CONTOUR_COLORS[id],
                  }),
                )}
                onChange={(color) => set("color", color)}
              />
            </>
          ) : (
            <>
              <Group title="Тень под фото">
                <Slider
                  label="Широкая: ширина %"
                  range={PRODUCTS_RANGES.aw}
                  value={value.products.shadow.aw}
                  digits={0}
                  onChange={(next) => setShadow("aw", next)}
                />
                <Slider
                  label="Широкая: высота px"
                  range={PRODUCTS_RANGES.ah}
                  value={value.products.shadow.ah}
                  digits={0}
                  onChange={(next) => setShadow("ah", next)}
                />
                <Slider
                  label="Широкая: размытие px"
                  range={PRODUCTS_RANGES.ab}
                  value={value.products.shadow.ab}
                  digits={0}
                  onChange={(next) => setShadow("ab", next)}
                />
                <Slider
                  label="Широкая: прозрачность"
                  range={PRODUCTS_RANGES.aa}
                  value={value.products.shadow.aa}
                  digits={2}
                  onChange={(next) => setShadow("aa", next)}
                />
                <Slider
                  label="Контактная: ширина %"
                  range={PRODUCTS_RANGES.cw}
                  value={value.products.shadow.cw}
                  digits={0}
                  onChange={(next) => setShadow("cw", next)}
                />
                <Slider
                  label="Контактная: высота px"
                  range={PRODUCTS_RANGES.ch}
                  value={value.products.shadow.ch}
                  digits={0}
                  onChange={(next) => setShadow("ch", next)}
                />
                <Slider
                  label="Контактная: размытие px"
                  range={PRODUCTS_RANGES.cb}
                  value={value.products.shadow.cb}
                  digits={0}
                  onChange={(next) => setShadow("cb", next)}
                />
                <Slider
                  label="Контактная: прозрачность"
                  range={PRODUCTS_RANGES.ca}
                  value={value.products.shadow.ca}
                  digits={2}
                  onChange={(next) => setShadow("ca", next)}
                />
                <Slider
                  label="Положение по высоте px"
                  hint="на сколько выше низа фото"
                  range={PRODUCTS_RANGES.y}
                  value={value.products.shadow.y}
                  digits={0}
                  onChange={(next) => setShadow("y", next)}
                />
                <Slider
                  label="Теплота цвета"
                  hint="0 — тёплый чёрный, 1 — рыжий"
                  range={PRODUCTS_RANGES.tint}
                  value={value.products.shadow.tint}
                  digits={2}
                  onChange={(next) => setShadow("tint", next)}
                />
              </Group>

              <Group title="Появление (один раз, при въезде в экран)">
                <Choice
                  label="Как появляется"
                  value={value.products.reveal.type}
                  options={(
                    Object.keys(REVEAL_NAMES) as ProductRevealSettings["type"][]
                  ).map((id) => ({ id, label: REVEAL_NAMES[id] }))}
                  onChange={(type) => setReveal("type", type)}
                />
                <Slider
                  label="Длительность мс"
                  range={PRODUCTS_RANGES.dur}
                  value={value.products.reveal.dur}
                  digits={0}
                  onChange={(next) => setReveal("dur", next)}
                />
                <Slider
                  label="Расстояние px"
                  range={PRODUCTS_RANGES.dist}
                  value={value.products.reveal.dist}
                  digits={0}
                  onChange={(next) => setReveal("dist", next)}
                />
                <Slider
                  label="Задержка колонок мс"
                  range={PRODUCTS_RANGES.stagger}
                  value={value.products.reveal.stagger}
                  digits={0}
                  onChange={(next) => setReveal("stagger", next)}
                />
                <Slider
                  label="Тень позже на мс"
                  range={PRODUCTS_RANGES.shadowDelay}
                  value={value.products.reveal.shadowDelay}
                  digits={0}
                  onChange={(next) => setReveal("shadowDelay", next)}
                />
              </Group>

              <Group title="Подъём при прокрутке (aterizare)">
                <label className="flex items-center gap-3 font-ui text-label">
                  <input
                    type="checkbox"
                    checked={value.products.lift.enabled}
                    onChange={(event) =>
                      setLift("enabled", event.target.checked)
                    }
                    className="size-4 accent-yellow"
                  />
                  Включён
                </label>
                <Slider
                  label="Интенсивность"
                  range={PRODUCTS_RANGES.amt}
                  value={value.products.lift.amt}
                  digits={2}
                  onChange={(next) => setLift("amt", next)}
                />
                <Slider
                  label="Плавность"
                  range={PRODUCTS_RANGES.smooth}
                  value={value.products.lift.smooth}
                  digits={2}
                  onChange={(next) => setLift("smooth", next)}
                />
                <Slider
                  label="Отклик тени"
                  range={PRODUCTS_RANGES.shadowReact}
                  value={value.products.lift.shadowReact}
                  digits={2}
                  onChange={(next) => setLift("shadowReact", next)}
                />
                <Slider
                  label="Подъём px"
                  range={PRODUCTS_RANGES.rise}
                  value={value.products.lift.rise}
                  digits={0}
                  onChange={(next) => setLift("rise", next)}
                />
                <Slider
                  label="Чувствительность"
                  hint="при какой скорости подъём полный"
                  range={PRODUCTS_RANGES.sensitivity}
                  value={value.products.lift.sensitivity}
                  digits={0}
                  onChange={(next) => setLift("sensitivity", next)}
                />
                <Slider
                  label="Приземление"
                  hint="меньше — дольше опускается"
                  range={PRODUCTS_RANGES.settle}
                  value={value.products.lift.settle}
                  digits={0}
                  onChange={(next) => setLift("settle", next)}
                />
                <Slider
                  label="Увеличение %"
                  range={PRODUCTS_RANGES.grow}
                  value={value.products.lift.grow}
                  digits={1}
                  onChange={(next) => setLift("grow", next)}
                />
                <Slider
                  label="Наклон °"
                  range={PRODUCTS_RANGES.tilt}
                  value={value.products.lift.tilt}
                  digits={1}
                  onChange={(next) => setLift("tilt", next)}
                />
              </Group>

              <div>
                <button
                  type="button"
                  onClick={copyLine}
                  className="h-10 rounded-pill border border-ink px-4 font-ui text-label transition-transform duration-150 ease-out active:scale-[0.97]"
                >
                  {copied ? "Скопировано" : "Copiază"}
                </button>
                <p className="mt-2 font-mono text-[11px] leading-relaxed break-all text-smoke select-all">
                  {productsLine(value)}
                </p>
              </div>
            </>
          )}

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

/** Подпись над группой ползунков: настроек во вкладке «Produse» много. */
function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-[15px] tracking-[0.1em] uppercase text-smoke">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Ползунок с границами из схемы настроек (src/motion/config-schema.ts). */
function Slider({
  label,
  hint,
  range,
  value,
  digits,
  onChange,
}: {
  label: string;
  /** Подпись под названием — когда по названию не очевидно, что это. */
  hint?: string;
  range: readonly [number, number, number];
  value: number;
  digits: number;
  onChange: (value: number) => void;
}) {
  const [min, max, step] = range;
  return (
    <label className="block">
      <span className="flex items-baseline justify-between font-ui text-label">
        {label}
        <span className="tabular-nums font-body text-meta text-smoke">
          {value.toFixed(digits)}
        </span>
      </span>
      {hint && (
        <span className="mt-1 block font-body text-meta text-smoke">
          {hint}
        </span>
      )}
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

/** Галочка «да / нет» — для настроек заставки. */
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 font-ui text-label">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-yellow"
      />
      {label}
    </label>
  );
}
