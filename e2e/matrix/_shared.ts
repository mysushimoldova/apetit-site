// Общие проверки матрицы браузеров. Один набор правил для всех восьми
// профилей: что бы мы ни открыли, страница обязана пройти этот список.
//
// Файл не заканчивается на .spec.ts — Playwright не считает его тестом.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  expect,
  type APIRequestContext,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/* ============================================================
   1. Ошибки браузера
   ============================================================ */

/** Замечания браузера, которые к сайту отношения не имеют. */
const NOISE = [
  // Драйвер видеокарты сборочной машины
  "GL Driver Message",
  // WebKit на Windows часто вовсе без WebGL: движок фона в этом случае
  // молча выключается (src/motion/engine.ts), но браузер успевает
  // написать своё замечание о невозможности создать контекст
  "Error creating WebGL context",
  "WebGL: context lost",
  // Firefox о шрифтах, которые он подставил сам — это не наша ошибка
  "downloadable font",
];

/** Ругань React про гидратацию и разметку — именно её ловим среди
 *  предупреждений. Шире брать нельзя: Firefox пишет в ту же консоль свои
 *  замечания (например про rel=preload), к React они отношения не имеют. */
const REACT_WARNING =
  /hydrat|didn't match|did not match|validateDOMNesting|Each child in a list|Warning: React/i;

export interface Problems {
  /** Всё, на что ругался браузер за время сценария. */
  list: string[];
}

/**
 * Подписаться на ошибки браузера. Любая ошибка консоли, любое необработанное
 * исключение и любое предупреждение про гидратацию — падение теста.
 */
export function watchProblems(
  page: Page,
  options: {
    /**
     * Адрес, который НАРОЧНО отвечает 404 (проверка страницы «не найдено»).
     * Сообщение браузера про этот самый документ — не дефект; чужие 404
     * (пропавшая картинка, шрифт) по-прежнему роняют тест.
     */
    expect404?: string;
  } = {},
): Problems {
  const list: string[] = [];
  const skip = (text: string) => NOISE.some((n) => text.includes(n));

  page.on("console", (message) => {
    const text = message.text();
    if (skip(text)) return;
    if (
      options.expect404 &&
      text.includes("404") &&
      message.location().url.endsWith(options.expect404)
    ) {
      return;
    }
    if (message.type() === "error") list.push(`консоль: ${text}`);
    else if (message.type() === "warning" && REACT_WARNING.test(text)) {
      list.push(`предупреждение React: ${text}`);
    }
  });
  page.on("pageerror", (error) => {
    if (skip(error.message)) return;
    list.push(`исключение: ${error.message}`);
  });
  return { list };
}

/* ============================================================
   2. Сдвиги вёрстки (CLS)
   ============================================================ */

/**
 * Счётчик сдвигов вёрстки на всё время сценария. PerformanceObserver с типом
 * layout-shift есть только в Chromium — в Safari и Firefox его нет вовсе,
 * тогда счётчик остаётся null и проверка пропускается (там за сдвигами
 * следят Chromium-профили).
 */
export async function installCls(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls?: number | null };
    w.__cls = null;
    try {
      const types = (
        PerformanceObserver as unknown as { supportedEntryTypes?: string[] }
      ).supportedEntryTypes;
      if (!types?.includes("layout-shift")) return;
      w.__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          };
          // Сдвиг сразу после нажатия человек считает откликом, не «прыжком»
          if (shift.hadRecentInput) continue;
          w.__cls = (w.__cls ?? 0) + shift.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {
      // Браузер не умеет — счётчик остаётся null
    }
  });
}

/**
 * Сколько сдвига вёрстки разрешено за сценарий. Цель — ноль, и все свои
 * сдвиги мы убрали. Допуск 0,002 закрывает единственное, что осталось и от
 * нас не зависит: Montserrat приезжает после показа страницы (так решено
 * ради скорости, src/lib/fonts.ts), строка перенабирается, и на русских
 * страницах текст сдвигается на 5–8 px. Это 0,001–0,0012 — в сто раз меньше
 * порога «плохо» (0,1). Разбор и два способа это убрать —
 * docs/qa/matrix-2026-09-23.md, пункт P3-1: решение архитектора
 * 23.09.2026 — оставлено.
 */
const CLS_MAX = 0.002;

/** Накопленный CLS или null, если браузер такого не считает. */
export function readCls(page: Page): Promise<number | null> {
  return page.evaluate(
    () => (window as unknown as { __cls?: number | null }).__cls ?? null,
  );
}

/* ============================================================
   3. Проверки одной страницы
   ============================================================ */

export interface AuditOptions {
  /** Имя для снимка: docs/screens/matrix/<проект>/<screen>.png */
  screen: string;
  /** Проверить, что ссылки страницы отвечают (медленно — не на каждом шаге). */
  request?: APIRequestContext;
  /** Не делать снимок (например, посреди сценария). */
  noShot?: boolean;
}

interface DomReport {
  scrollWidth: number;
  clientWidth: number;
  fallbackFonts: string[];
  brokenImages: string[];
  stalledVideos: string[];
  clipped: string[];
}

/**
 * Полный обход страницы: горизонтальный скролл, шрифты, картинки, видео,
 * обрезанный текст, размер кликабельных элементов. Возвращает список бед.
 */
async function inspectDom(page: Page): Promise<DomReport> {
  return page.evaluate(async () => {
    /** Короткое имя элемента для отчёта: «button.cart-add «Adaugă»». */
    const describe = (el: Element): string => {
      const tag = el.tagName.toLowerCase();
      const name = typeof el.className === "string" ? el.className.trim() : "";
      const cls = name ? "." + name.split(/\s+/).slice(0, 2).join(".") : "";
      const text = (el.textContent || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 40);
      return tag + cls + (text ? ` «${text}»` : "");
    };
    const root = document.documentElement;
    // Открыт лист — смотрим только его: страницу под ним браузер делает
    // недоступной, её ленивые картинки честно не грузятся, и спрашивать
    // с них нечего.
    const scope: ParentNode =
      document.querySelector("dialog[open]") ?? document;

    // --- шрифты: фирменное семейство должно быть загружено и покрывать текст
    const fallbackFonts: string[] = [];
    await document.fonts.ready;
    const seen = new Set<string>();
    for (const el of Array.from(scope.querySelectorAll("*"))) {
      // только элементы с собственным текстом
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent || "")
        .join("")
        .trim();
      if (!own) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      const first = style.fontFamily
        .split(",")[0]
        .trim()
        .replace(/^["']|["']$/g, "");
      // Фирменные семейства next/font зовутся «__Oswald_1a2b3c» и т.п.
      if (!/^__(Oswald|Manrope|Montserrat)_/.test(first)) continue;
      const key = `${first}|${style.fontWeight}|${own.slice(0, 30)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const shorthand = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} "${first}"`;
      let ok = false;
      try {
        ok = document.fonts.check(shorthand, own);
      } catch {
        ok = true; // браузер не понял запись — не выдумываем дефект
      }
      if (!ok) fallbackFonts.push(`${first} ← ${describe(el)}`);
    }

    // --- картинки и видео
    const brokenImages: string[] = [];
    for (const img of Array.from(scope.querySelectorAll("img"))) {
      if (img.naturalWidth === 0) brokenImages.push(describe(img));
    }
    const stalledVideos: string[] = [];
    for (const video of Array.from(scope.querySelectorAll("video"))) {
      if (video.readyState < 2) stalledVideos.push(describe(video));
    }

    // --- обрезанный текст: элемент прячет СВОЙ текст, который в него не влез.
    // Смотрим только на элементы с собственными текстовыми узлами. Иначе в
    // список попадают контейнеры, которые обрезают не текст, а украшение:
    // например <main> с overflow-x: clip режет мягкую тень под фото — она
    // нарочно шире плитки (.food-shadow-layers), и обрезать её у края
    // страницы задумано (globals.css → menu-main).
    const clipped: string[] = [];
    for (const el of Array.from(scope.querySelectorAll("*"))) {
      const style = getComputedStyle(el);
      // auto/scroll — лента, её двигают пальцем, так и задумано
      if (style.overflowX !== "hidden" && style.overflowX !== "clip") continue;
      // Заголовок для скринридера (sr-only) размером 1×1 — глазами его никто
      // не читает, «обрезанным» он быть не может
      if (el.clientWidth <= 1 || el.clientHeight <= 1) continue;
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent || "")
        .join("")
        .trim();
      if (!own) continue;
      if (el.scrollWidth > el.clientWidth + 1) {
        clipped.push(`${describe(el)} (${el.scrollWidth}>${el.clientWidth})`);
      }
    }

    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      fallbackFonts,
      brokenImages,
      stalledVideos,
      clipped,
    };
  });
}

/* ---------- Палец: область нажатия не мельче 44×44 ---------- */

/**
 * Проверяет не рамку элемента, а то, куда реально попадает палец.
 * Область нажатия часто больше самой кнопки: её растягивает невидимый
 * ::after (так сделано у названия блюда — нажимается вся плитка). Поэтому
 * меряем document.elementFromPoint по углам квадрата 44×44 вокруг центра
 * кнопки: попал в неё саму или в её потомка — засчитано.
 *
 * Заодно ловится обратное: кнопка крупная, но её закрывает липкая шапка или
 * панель корзины — палец попадёт не туда.
 *
 * Идём по странице экран за экраном: elementFromPoint работает только с тем,
 * что сейчас в окне. Если открыт лист (модальный <dialog>), смотрим только
 * его: всё, что под ним, браузер и так делает недоступным.
 */
export async function checkTapTargets(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const SIZE = 44;
    const SELECTOR =
      "a[href], button, [role='button'], input:not([type='hidden']), select, textarea, summary";
    const bad = new Map<string, string>();
    const seen = new Set<Element>();
    const dialog = document.querySelector("dialog[open]");
    const scope: ParentNode = dialog ?? document;
    // Страница под открытым листом не прокручивается — прокручиваем сам лист
    const scroller: Element | null = dialog
      ? dialog.querySelector(".sheet-body")
      : null;

    const describe = (el: Element): string => {
      const tag = el.tagName.toLowerCase();
      const name = typeof el.className === "string" ? el.className.trim() : "";
      const cls = name ? "." + name.split(/\s+/).slice(0, 2).join(".") : "";
      const label =
        el.getAttribute("aria-label") ||
        (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 30);
      return tag + cls + (label ? ` «${label}»` : "");
    };

    const step = (scroller ?? document.documentElement).clientHeight * 0.8;
    const height = (scroller ?? document.documentElement).scrollHeight;
    for (let y = 0; y <= height; y += step) {
      if (scroller) scroller.scrollTop = y;
      else window.scrollTo(0, y);
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
      // Липкая шапка, лента чипов и панель корзины висят поверх страницы.
      // Кнопку, которая сейчас под ними, мерить бессмысленно: её просто
      // домотают до чистого места. Считаем свободную полосу окна.
      const chrome = Array.from(document.querySelectorAll("body *")).filter(
        (el) => {
          const p = getComputedStyle(el).position;
          return p === "fixed" || p === "sticky";
        },
      );
      let bandTop = 0;
      let bandBottom = window.innerHeight;
      for (const el of chrome) {
        const b = el.getBoundingClientRect();
        if (b.height === 0 || b.width === 0) continue;
        if (b.top <= 0) bandTop = Math.max(bandTop, b.bottom);
        if (b.bottom >= window.innerHeight) {
          bandBottom = Math.min(bandBottom, b.top);
        }
      }

      for (const el of Array.from(scope.querySelectorAll(SELECTOR))) {
        if (seen.has(el)) continue;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const box = el.getBoundingClientRect();
        // Спрятанное поле формы (sr-only): нажимают его подпись, не его
        if (box.width <= 1 || box.height <= 1) continue;
        // Целиком в окне? Иначе проверим на другом шаге прокрутки
        if (box.top < 0 || box.bottom > window.innerHeight) continue;
        // Сам элемент может быть липким (кнопка в шапке) — его меряем как
        // есть; остальные — только на свободной полосе, вне накладок
        const sticky =
          style.position === "fixed" || style.position === "sticky";
        const inChrome = chrome.some((c) => c.contains(el));
        if (!sticky && !inChrome) {
          if (box.top < bandTop + 2 || box.bottom > bandBottom - 2) continue;
        }
        seen.add(el);

        // Ссылка внутри строки текста (правовые страницы): растянуть её до
        // 44px нельзя, не разорвав абзац. WCAG 2.2 такие и не требует.
        if (el.tagName === "A" && style.display.startsWith("inline")) continue;

        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;

        // Сначала сам центр: если в него попадает что-то другое, кнопку
        // просто закрыли сверху (липкая шапка, панель корзины)
        const middle = document.elementFromPoint(cx, cy);
        if (!middle || !(middle === el || el.contains(middle))) {
          bad.set(
            describe(el),
            `${describe(el)}: центр закрыт ${describe(middle ?? el)}`,
          );
          continue;
        }

        // Размах области нажатия: шагаем от центра в стороны, пока палец
        // попадает в саму кнопку (или в её потомка, или в её невидимый
        // ::after). Край экрана засчитываем как «дотянулись»: за него
        // пальцем всё равно не нажать.
        const reach = (dx: number, dy: number): number => {
          let last = 0;
          for (let d = 1; d <= SIZE; d++) {
            const x = cx + dx * d;
            const y = cy + dy * d;
            if (
              x < 0 ||
              y < 0 ||
              x > window.innerWidth ||
              y > window.innerHeight
            ) {
              return SIZE;
            }
            const hit = document.elementFromPoint(x, y);
            if (!hit || !(hit === el || el.contains(hit))) break;
            last = d;
          }
          return last;
        };
        const width = reach(-1, 0) + reach(1, 0) + 1;
        const height = reach(0, -1) + reach(0, 1) + 1;
        // Скидка 2px: браузер не считает нажатием самый край скруглённой
        // кнопки, да и половинки пикселей на телефоне с dpr 3 округляются
        // в разные стороны. Настоящая мелкая кнопка (38px) в эту скидку
        // не пролезет.
        if (width < SIZE - 2 || height < SIZE - 2) {
          bad.set(
            describe(el),
            `${describe(el)}: рамка ${Math.round(box.width)}×${Math.round(box.height)}, нажимается ${width}×${height}`,
          );
        }
      }
    }
    if (scroller) scroller.scrollTop = 0;
    else window.scrollTo(0, 0);
    return [...bad.values()];
  });
}

/**
 * Прокрутить страницу целиком — чтобы ленивые картинки успели запроситься.
 * Если открыт лист, прокручиваем его: страница под ним заблокирована.
 */
export async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const sheet = document
      .querySelector("dialog[open]")
      ?.querySelector(".sheet-body");
    const box = sheet ?? document.documentElement;
    const step = box.clientHeight * 0.8;
    for (let y = 0; y < box.scrollHeight; y += step) {
      if (sheet) sheet.scrollTop = y;
      else window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    if (sheet) sheet.scrollTop = 0;
    else window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 200));
  });
}

/**
 * Снимок первого экрана: docs/screens/matrix/<проект>/<имя>.png. Первый
 * экран, а не вся страница целиком, — как в docs/screens (npm run screens):
 * меню целиком на трёх пикселях на точку весит мегабайты, а сравнивают
 * профили всё равно по первому экрану. Что ниже — проверено кодом.
 */
export async function shot(
  page: Page,
  info: TestInfo,
  screen: string,
  options: { density?: boolean } = {},
): Promise<void> {
  // Значок «N» dev-режима Next — не часть сайта
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
  await page.screenshot({
    path: `docs/screens/matrix/${info.project.name}/${screen}.png`,
    fullPage: false,
    // scale: "css" — снимок в CSS-пикселях, а не в точках экрана. На телефоне
    // с тройной плотностью это в девять раз меньше пикселей и во столько же
    // легче файл: вся матрица помещается в десяток мегабайт, а не в сотню.
    // density: true — там, где нужна настоящая плотность (резкость линий).
    scale: options.density ? "device" : "css",
  });
}

/** Ссылки, которые уже проверяли: один адрес на прогон достаточно. */
const checkedLinks = new Set<string>();

/** Все внутренние ссылки страницы отвечают без ошибки. */
async function checkLinks(
  page: Page,
  request: APIRequestContext,
): Promise<string[]> {
  const hrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href]")).map(
      (a) => (a as HTMLAnchorElement).href,
    ),
  );
  const origin = new URL(page.url()).origin;
  const bad: string[] = [];
  for (const href of new Set(hrefs)) {
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      continue;
    }
    // Чужие сайты, почта и телефон не дёргаем
    if (url.origin !== origin) continue;
    const key = url.pathname + url.search;
    if (checkedLinks.has(key)) continue;
    checkedLinks.add(key);
    const response = await request.get(origin + key, {
      failOnStatusCode: false,
    });
    if (response.status() !== 200) bad.push(`${key} → ${response.status()}`);
  }
  return bad;
}

/**
 * Полная проверка открытой страницы. Зовётся после того, как страница
 * показана и сценарий на ней отработал.
 */
export async function auditPage(
  page: Page,
  info: TestInfo,
  problems: Problems,
  options: AuditOptions,
): Promise<void> {
  const isMobile = info.project.use.isMobile === true;
  const where = `${info.project.name} · ${options.screen}`;

  await scrollThrough(page);
  // Ленивые картинки после прокрутки: дать им догрузиться
  await page
    .waitForFunction(
      () => Array.from(document.images).every((i) => i.complete),
      undefined,
      { timeout: 15_000 },
    )
    .catch(() => {});

  const dom = await inspectDom(page);

  expect(dom.fallbackFonts, `${where}: текст набран запасным шрифтом`).toEqual(
    [],
  );
  expect(dom.brokenImages, `${where}: картинка не загрузилась`).toEqual([]);
  expect(dom.stalledVideos, `${where}: видео не готово`).toEqual([]);
  expect(dom.clipped, `${where}: текст обрезан`).toEqual([]);
  if (isMobile) {
    expect(
      await checkTapTargets(page),
      `${where}: до кнопки не дотянуться пальцем (нужен квадрат 44×44)`,
    ).toEqual([]);
  }
  expect(
    dom.scrollWidth,
    `${where}: страница шире экрана (горизонтальный скролл)`,
  ).toBeLessThanOrEqual(dom.clientWidth);

  const cls = await readCls(page);
  if (cls !== null) {
    expect(cls, `${where}: вёрстка прыгает (CLS)`).toBeLessThanOrEqual(CLS_MAX);
  }

  if (options.request) {
    const bad = await checkLinks(page, options.request);
    expect(bad, `${where}: ссылка не отвечает`).toEqual([]);
  }

  if (!options.noShot) await shot(page, info, options.screen);

  expect(problems.list, `${where}: браузер ругается`).toEqual([]);
}

/* ============================================================
   4. Мелочи, нужные во многих тестах
   ============================================================ */

/** Рабочее время: 12:00 в Кишинёве — «Comandă» активна. */
export const OPEN_TIME = "2026-09-19T09:00:00Z";
/** Нерабочее время: 23:30 — точка закрыта. */
export const CLOSED_TIME = "2026-09-19T20:30:00Z";

/** Поставить время и браузеру, и серверу (заголовок работает при APETIT_E2E=1). */
export async function setTime(
  page: Page,
  value: string,
  server = value,
): Promise<void> {
  await page.clock.setFixedTime(new Date(value));
  await page.setExtraHTTPHeaders({ "x-apetit-test-now": server });
}

/** Открыть адрес и дождаться, пока страница полностью показана. */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("load");
  // Движок фона подключается после показа страницы — даём ему завестись
  await page.waitForTimeout(800);
}

/** Строка корзины в том виде, в каком её хранит zustand persist. */
export interface CartLine {
  productSlug: string;
  variantId: string | null;
  addonIds: string[];
  removedIds: string[];
  qty: number;
}

export const cartLine = (productSlug: string, qty = 1): CartLine => ({
  productSlug,
  variantId: null,
  addonIds: [],
  removedIds: [],
  qty,
});

/** Положить корзину в localStorage до загрузки страницы. */
export async function seedCart(
  page: Page,
  city: string,
  lines: CartLine[],
): Promise<void> {
  await page.addInitScript(
    ([c, l]) =>
      window.localStorage.setItem(
        "apetit.cart",
        JSON.stringify({ state: { city: c, lines: l }, version: 1 }),
      ),
    [city, lines] as const,
  );
}

/* ============================================================
   5. Настоящие заказы, которые оставляют тесты
   ============================================================ */

/**
 * Телефоны для заказов и уборка за собой. Тесты оформляют НАСТОЯЩИЕ заказы в
 * базе (Telegram при APETIT_E2E подменён, а база одна), поэтому каждый файл,
 * который отправляет заказ, зовёт это в начале и удаляет свои строки в конце.
 * Удаляем только по своим телефонам и тестовому имени — чужого не трогаем.
 */
export function orderCleanup(test: {
  afterAll: (fn: () => Promise<void>) => void;
}): () => string {
  const phones: string[] = [];
  test.afterAll(async () => {
    const envFile = resolve(process.cwd(), ".env.local");
    if (phones.length === 0 || !existsSync(envFile)) return;
    process.loadEnvFile(envFile);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await db
      .from("orders")
      .delete()
      .eq("name", TEST_NAME)
      .in("phone", phones);
    if (error)
      throw new Error(`уборка заказов: ${error.code} ${error.message}`);
  });
  return () => {
    const digits = String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
    phones.push(`+37369${digits}`); // как хранится в базе
    return `069${digits}`;
  };
}

/** Имя, по которому узнаём свои заказы при уборке. */
export const TEST_NAME = "Ion Popescu";

/* ============================================================
   6. Чтение CSS страницы
   ============================================================ */

export interface CssRule {
  selector: string;
  /** Текст правила целиком — в нём ищем свойства. */
  text: string;
  /** Условия @media, внутри которых лежит правило. */
  media: string[];
}

/**
 * Все правила наших стилей, с условиями @media, внутри которых они лежат.
 *
 * Обход идёт по любому правилу, у которого есть вложенные (`cssRules`): это
 * и @media, и @supports, и @layer. Без @layer обход возвращал почти пустой
 * список — Tailwind 4 складывает в слои вообще всё, и проверки молча
 * проходили, ничего не проверив.
 */
export async function cssRules(page: Page): Promise<CssRule[]> {
  const rules = await page.evaluate(() => {
    const out: { selector: string; text: string; media: string[] }[] = [];
    const walk = (list: CSSRuleList, media: string[]) => {
      for (const rule of Array.from(list)) {
        const inner = media.concat(
          rule instanceof CSSMediaRule ? [rule.conditionText] : [],
        );
        if (rule instanceof CSSStyleRule) {
          out.push({
            selector: rule.selectorText,
            text: rule.cssText,
            media: inner,
          });
        }
        const nested = (rule as CSSGroupingRule).cssRules;
        if (nested) walk(nested, inner);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      const node = sheet.ownerNode as Element | null;
      if (node?.nodeName !== "LINK" && node?.nodeName !== "STYLE") continue;
      try {
        walk(sheet.cssRules, []);
      } catch {
        // Чужой файл читать нельзя — и не надо
      }
    }
    return out;
  });
  // Страховка от «проверка прошла, потому что читать было нечего»
  expect(rules.length, "стили страницы не прочитались").toBeGreaterThan(100);
  return rules;
}
