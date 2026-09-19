# Экран выбора города — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Маршрут `/` показывает пять плиток городов, выбор ведёт на `/[city]` и запоминается на устройстве; повторное открытие `/` сразу уходит на сохранённый город без мигания.

**Architecture:** Данные точек — статический модуль `src/data/points.ts` (потом переедут в Supabase, API модуля сохранится). Экран городов — серверная страница `/` с крошечным inline-скриптом (редирект до гидрации, чтобы не мигало) и клиентским компонентом `CityGrid` (motion, stагger). Страница `/[city]` — серверная, статическая (`generateStaticParams`), неизвестный slug → 404; на ней клиентский `RememberCity` записывает выбор в localStorage.

**Tech Stack:** Next.js 16 (App Router) · TypeScript strict · Tailwind CSS 4 · motion 13 (`motion/react`) · Vitest 5 · Playwright 1.63.

**Spec:** промпт архитектора от 19.09.2026 (раздел «одна задача — экран выбора города»), SPEC.md §1.1, §3 шаг 1, §8; DESIGN.md → Tokens, Motion.

## Global Constraints

- Цвета только из токенов: Cream `#F6F1E9`, Ink `#1A1714`, Milk `#FCFAF6`. Чистый белый/чёрный запрещены.
- Шрифт названий городов: Oswald 600, 44px, заглавными, letter-spacing 0.02em (`font-display text-city uppercase`).
- Плитка: без заливки, рамка 1px Ink, радиус 16px, высота 88px. Нажатие: заливка Ink, текст Cream, 150ms (`--dur-fast`).
- Телефон: столбик, зазор 12px, боковой отступ 16px. Десктоп (≥1024px): сетка, плитки шириной 200px.
- Анимация входа: y 24→0, opacity 0→1, задержка 60ms между плитками, easing `cubic-bezier(0.2, 0.8, 0.2, 1)` (`--ease-out`), длительность `--dur-slow` 420ms. `prefers-reduced-motion` → без анимации.
- На экране городов больше ничего: ни шапки, ни подвала, ни логотипа, ни текста, ни крестика.
- Никаких выдуманных текстов. Нет текста → `[ТЕКСТ: …]`.
- Телефоны в формате `0XXXXXXXX` (9 цифр). Адреса пустые с TODO.
- Никаких новых библиотек.

## Review Focus

1. В localStorage лежит мусор (старый/чужой slug, `"chisinau"`, JSON) → должен показаться экран городов, а не редирект на 404. — тест в Task 2 и Task 3.
2. localStorage недоступен (приватный режим Safari бросает исключение) → экран работает, ничего не падает. — тест в Task 2 и Task 3.
3. Неизвестный slug `/chisinau` → HTTP 404, не пустая страница. — e2e в Task 4.
4. `prefers-reduced-motion: reduce` → плитки видны сразу, без сдвига. — e2e в Task 5 (проверка итогового состояния).
5. Открытие `/soroca` по прямой ссылке (Google, новая вкладка) тоже должно запоминать город — поэтому запись делается на странице города, а не только по клику. — e2e в Task 5.

## «Допрос плана» (grill-me недоступен — вопросы задал себе, решения ниже)

| Вопрос | Решение |
|---|---|
| DESIGN.md в репо описывает City Tile иначе (Milk-заливка, 24px, 96px, шесть плиток). Чему верить? | Промпту архитектора: он явно перечисляет новые значения. Расхождение фиксируем в PROGRESS.md и просим обновлённый DESIGN.md. Токены `--radius-tile` не трогаем, значения задаём в компоненте. |
| «Плитки 200px» на десктопе — ширина или квадрат? | Ширина 200px, высота остаётся 88px (в задаче одна высота). Ряд центрируется, при нехватке места переносится. |
| Где сохранять выбор — по клику или на странице города? | На странице города (`RememberCity`): покрывает прямые ссылки из Google и «открыть в новой вкладке». Клик не нужен. |
| Как сделать редирект «без мигания»? | Inline-скрипт в начале `<body>` страницы `/`: читает localStorage и делает `location.replace` до того, как React загрузился. Это стандартный приём (как для тем light/dark). Fallback на клиентскую навигацию не нужен: на `/` клиентом попадают только через «сменить город», а он сначала чистит выбор. |
| Что с кнопкой «назад» после редиректа? | `location.replace` заменяет запись истории, ловушки нет. |
| Фоновые пятна (Background Glow) на экране городов? | В задаче не упомянуты — не рисуем. Вопрос архитектору в PROGRESS.md. |
| Длительность входа 420ms превышает «200–300ms» из CLAUDE.md. | DESIGN.md отдаёт `--dur-slow` 420ms именно экрану городов; используем токен. Вопрос в PROGRESS.md. |
| Hover на десктопе? | Едва заметный: заливка Milk, только при `(hover: hover) and (pointer: fine)`. |
| Страница 404 — стандартная Next (белая, английская). | Оставляем: своя нужна с текстом от Амяна. Вопрос в PROGRESS.md. |

---

### Task 1: Данные точек

**Files:**
- Create: `src/data/points.ts`
- Test: `src/data/points.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type CitySlug = "soroca" | "sculeni" | "floresti" | "otaci" | "briceni";
  export type Locale = "ro" | "ru";
  export interface City { slug: CitySlug; name: string; locale: Locale }
  export interface Point { id: string; citySlug: CitySlug; name: string; phone: string; ownership: "own" | "franchise"; locale: Locale; hours: { open: string; close: string }; address: string }
  export const CITIES: readonly City[]      // 5, в порядке SPEC
  export const POINTS: readonly Point[]     // 6
  export function isCitySlug(value: string): value is CitySlug
  export function getCity(slug: CitySlug): City
  ```

- [ ] **Step 1: Написать падающий тест**

```ts
// src/data/points.test.ts
import { describe, expect, it } from "vitest";
import { CITIES, POINTS, getCity, isCitySlug } from "./points";

describe("точки (SPEC 1.1)", () => {
  it("шесть точек", () => {
    expect(POINTS).toHaveLength(6);
  });

  it("пять городов в порядке SPEC", () => {
    expect(CITIES.map((c) => c.slug)).toEqual([
      "soroca",
      "sculeni",
      "floresti",
      "otaci",
      "briceni",
    ]);
  });

  it("slug городов уникальны и в нижнем регистре латиницей", () => {
    const slugs = CITIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z]+$/);
  });

  it("id и телефоны точек уникальны", () => {
    expect(new Set(POINTS.map((p) => p.id)).size).toBe(POINTS.length);
    expect(new Set(POINTS.map((p) => p.phone)).size).toBe(POINTS.length);
  });

  it("телефоны в формате 0XXXXXXXX", () => {
    for (const p of POINTS) expect(p.phone).toMatch(/^0\d{8}$/);
  });

  it("каждая точка ссылается на существующий город", () => {
    for (const p of POINTS) expect(isCitySlug(p.citySlug)).toBe(true);
  });

  it("в Сороках две точки, в остальных по одной", () => {
    const count = (slug: string) => POINTS.filter((p) => p.citySlug === slug).length;
    expect(count("soroca")).toBe(2);
    for (const slug of ["sculeni", "floresti", "otaci", "briceni"]) expect(count(slug)).toBe(1);
  });

  it("Otaci — русский по умолчанию, остальные — румынский", () => {
    expect(getCity("otaci").locale).toBe("ru");
    for (const c of CITIES.filter((c) => c.slug !== "otaci")) expect(c.locale).toBe("ro");
  });

  it("все точки работают 08:30–23:00", () => {
    for (const p of POINTS) expect(p.hours).toEqual({ open: "08:30", close: "23:00" });
  });

  it("isCitySlug отвергает чужие значения", () => {
    expect(isCitySlug("chisinau")).toBe(false);
    expect(isCitySlug("Soroca")).toBe(false);
    expect(isCitySlug("")).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить — должен упасть**

Run: `npx vitest run src/data/points.test.ts`
Expected: FAIL — «Cannot find module './points'».

- [ ] **Step 3: Реализация**

```ts
// src/data/points.ts
// Точки Apetit — SPEC.md §1.1 (РЕШЕНО). Пока статический список; на этапе
// админки переедет в Supabase, а эти типы и функции останутся.

export type CitySlug = "soroca" | "sculeni" | "floresti" | "otaci" | "briceni";

/** Язык интерфейса по умолчанию для города (SPEC §3 шаг 1: Otaci → ru). */
export type Locale = "ro" | "ru";

export interface City {
  slug: CitySlug;
  /** Название как в меню — латиницей, на обоих языках одинаково. */
  name: string;
  locale: Locale;
}

export interface Point {
  id: string;
  citySlug: CitySlug;
  name: string;
  /** Формат Молдовы без кода страны: 0XXXXXXXX. */
  phone: string;
  ownership: "own" | "franchise";
  locale: Locale;
  hours: { open: string; close: string };
  address: string;
}

const HOURS = { open: "08:30", close: "23:00" } as const;

/** Пять городов в порядке SPEC §1.1 — в этом порядке рисуются плитки. */
export const CITIES: readonly City[] = [
  { slug: "soroca", name: "Soroca", locale: "ro" },
  { slug: "sculeni", name: "Sculeni", locale: "ro" },
  { slug: "floresti", name: "Florești", locale: "ro" },
  { slug: "otaci", name: "Otaci", locale: "ru" },
  { slug: "briceni", name: "Briceni", locale: "ro" },
];

// TODO: адреса точек — УТОЧНИТЬ у Амяна (SPEC §1.1)
export const POINTS: readonly Point[] = [
  { id: "soroca-centru", citySlug: "soroca", name: "Apetit Centru", phone: "067578757", ownership: "own", locale: "ro", hours: HOURS, address: "" },
  { id: "soroca-noua", citySlug: "soroca", name: "Apetit Soroca Nouă", phone: "068372707", ownership: "own", locale: "ro", hours: HOURS, address: "" },
  { id: "sculeni", citySlug: "sculeni", name: "Apetit Sculeni", phone: "060696527", ownership: "franchise", locale: "ro", hours: HOURS, address: "" },
  { id: "floresti", citySlug: "floresti", name: "Apetit Florești", phone: "078879606", ownership: "franchise", locale: "ro", hours: HOURS, address: "" },
  { id: "otaci", citySlug: "otaci", name: "Apetit Otaci", phone: "069247474", ownership: "franchise", locale: "ru", hours: HOURS, address: "" },
  { id: "briceni", citySlug: "briceni", name: "Apetit Briceni", phone: "076777123", ownership: "franchise", locale: "ro", hours: HOURS, address: "" },
];

const CITY_SLUGS: ReadonlySet<string> = new Set(CITIES.map((c) => c.slug));

export function isCitySlug(value: string): value is CitySlug {
  return CITY_SLUGS.has(value);
}

export function getCity(slug: CitySlug): City {
  const city = CITIES.find((c) => c.slug === slug);
  if (!city) throw new Error(`Unknown city slug: ${slug}`);
  return city;
}
```

- [ ] **Step 4: Запустить — должен пройти**

Run: `npx vitest run src/data/points.test.ts`
Expected: PASS, 10 тестов.

- [ ] **Step 5: Коммит** — не отдельный: вся задача коммитится одним коммитом `feat: city selection screen` в Task 7.

---

### Task 2: Память выбора (localStorage)

**Files:**
- Create: `src/lib/city-storage.ts`
- Test: `src/lib/city-storage.test.ts`

**Interfaces:**
- Consumes: `CitySlug`, `isCitySlug` из Task 1.
- Produces:
  ```ts
  export const CITY_STORAGE_KEY = "apetit.city";
  export function getSavedCity(): CitySlug | null
  export function saveCity(slug: CitySlug): void
  export function clearCity(): void
  ```

- [ ] **Step 1: Падающий тест**

```ts
// src/lib/city-storage.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { CITY_STORAGE_KEY, clearCity, getSavedCity, saveCity } from "./city-storage";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

function withWindow(storage: unknown) {
  vi.stubGlobal("window", { localStorage: storage });
}

afterEach(() => vi.unstubAllGlobals());

describe("память выбранного города", () => {
  it("возвращает null, если ничего не сохранено", () => {
    withWindow(fakeStorage());
    expect(getSavedCity()).toBeNull();
  });

  it("сохраняет и читает slug", () => {
    const s = fakeStorage();
    withWindow(s);
    saveCity("otaci");
    expect(s.data.get(CITY_STORAGE_KEY)).toBe("otaci");
    expect(getSavedCity()).toBe("otaci");
  });

  it("очищает выбор", () => {
    const s = fakeStorage({ [CITY_STORAGE_KEY]: "soroca" });
    withWindow(s);
    clearCity();
    expect(getSavedCity()).toBeNull();
  });

  it("мусор в хранилище → null (не редиректим на 404)", () => {
    withWindow(fakeStorage({ [CITY_STORAGE_KEY]: "chisinau" }));
    expect(getSavedCity()).toBeNull();
  });

  it("localStorage бросает исключение → null и не падает", () => {
    withWindow({
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => { throw new Error("QuotaExceeded"); },
      removeItem: () => { throw new Error("SecurityError"); },
    });
    expect(getSavedCity()).toBeNull();
    expect(() => saveCity("soroca")).not.toThrow();
    expect(() => clearCity()).not.toThrow();
  });

  it("без window (на сервере) → null и не падает", () => {
    expect(getSavedCity()).toBeNull();
    expect(() => saveCity("soroca")).not.toThrow();
  });
});
```

- [ ] **Step 2: Запустить — упасть**

Run: `npx vitest run src/lib/city-storage.test.ts` → FAIL, модуль не найден.

- [ ] **Step 3: Реализация**

```ts
// src/lib/city-storage.ts
// Выбранный город запоминается на устройстве (SPEC §3 шаг 1).
// Всё обёрнуто в try/catch: в приватном режиме Safari localStorage бросает
// исключение, а на сервере window нет вообще.
import { isCitySlug, type CitySlug } from "@/data/points";

export const CITY_STORAGE_KEY = "apetit.city";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function getSavedCity(): CitySlug | null {
  try {
    const value = storage()?.getItem(CITY_STORAGE_KEY);
    return value && isCitySlug(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveCity(slug: CitySlug): void {
  try {
    storage()?.setItem(CITY_STORAGE_KEY, slug);
  } catch {
    // нет места или запрещено — просто не запоминаем
  }
}

export function clearCity(): void {
  try {
    storage()?.removeItem(CITY_STORAGE_KEY);
  } catch {
    // ничего
  }
}
```

- [ ] **Step 4: Запустить — пройти** — `npx vitest run src/lib/city-storage.test.ts` → PASS, 6 тестов.

---

### Task 3: Inline-скрипт редиректа (без мигания)

**Files:**
- Create: `src/lib/city-redirect-script.ts`
- Test: `src/lib/city-redirect-script.test.ts`

**Interfaces:**
- Consumes: `CITIES` (Task 1), `CITY_STORAGE_KEY` (Task 2).
- Produces: `export function buildCityRedirectScript(): string` — текст JS для `<script>` в начале body страницы `/`.

- [ ] **Step 1: Падающий тест** — скрипт исполняется в `new Function` с подменёнными `localStorage` и `location`, то есть проверяется настоящее поведение.

```ts
// src/lib/city-redirect-script.test.ts
import { describe, expect, it } from "vitest";
import { buildCityRedirectScript } from "./city-redirect-script";
import { CITY_STORAGE_KEY } from "./city-storage";

function run(saved: string | null | (() => never)) {
  const replaced: string[] = [];
  const localStorage = {
    getItem: typeof saved === "function" ? saved : () => saved,
  };
  const location = { replace: (url: string) => void replaced.push(url) };
  new Function("localStorage", "location", buildCityRedirectScript())(localStorage, location);
  return replaced;
}

describe("inline-скрипт редиректа на сохранённый город", () => {
  it("сохранён soroca → location.replace('/soroca')", () => {
    expect(run("soroca")).toEqual(["/soroca"]);
  });

  it("ничего не сохранено → без редиректа", () => {
    expect(run(null)).toEqual([]);
  });

  it("мусор в хранилище → без редиректа", () => {
    expect(run("chisinau")).toEqual([]);
    expect(run("soroca/../admin")).toEqual([]);
    expect(run("")).toEqual([]);
  });

  it("localStorage бросает → скрипт не падает", () => {
    expect(() =>
      run(() => {
        throw new Error("SecurityError");
      }),
    ).not.toThrow();
  });

  it("использует тот же ключ, что и city-storage", () => {
    expect(buildCityRedirectScript()).toContain(CITY_STORAGE_KEY);
  });
});
```

- [ ] **Step 2: Запустить — упасть** — модуль не найден.

- [ ] **Step 3: Реализация**

```ts
// src/lib/city-redirect-script.ts
// Крошечный скрипт, который вставляется в начало <body> страницы «/».
// Он выполняется браузером ДО загрузки React: если город уже выбран —
// уходим на него сразу, и экран городов не успевает мигнуть.
// location.replace — чтобы кнопка «назад» не возвращала на «/».
import { CITIES } from "@/data/points";
import { CITY_STORAGE_KEY } from "./city-storage";

export function buildCityRedirectScript(): string {
  const slugs = CITIES.map((c) => c.slug).join("|");
  return (
    "try{" +
    `var c=localStorage.getItem(${JSON.stringify(CITY_STORAGE_KEY)});` +
    `if(c&&/^(${slugs})$/.test(c))location.replace("/"+c)` +
    "}catch(e){}"
  );
}
```

- [ ] **Step 4: Запустить — пройти** — 5 тестов.

---

### Task 4: Страница `/[city]` (заглушка) + запоминание + «сменить город»

**Files:**
- Create: `src/app/[city]/page.tsx`
- Create: `src/components/city/remember-city.tsx`
- Create: `src/lib/use-change-city.ts`
- Test: `e2e/city-page.spec.ts`

**Interfaces:**
- Consumes: `CITIES`, `getCity`, `isCitySlug`, `CitySlug` (Task 1); `saveCity`, `clearCity` (Task 2).
- Produces: `useChangeCity(): () => void` — хук для будущей кнопки в шапке.

- [ ] **Step 1: Падающий e2e-тест**

```ts
// e2e/city-page.spec.ts
import { expect, test } from "@playwright/test";

test("страница города показывает название и заглушку меню", async ({ page }) => {
  await page.goto("/soroca");
  await expect(page.locator("h1")).toHaveText("Soroca");
  await expect(page.getByText("[ТЕКСТ: меню скоро]")).toBeVisible();
});

test("название с диакритикой рендерится", async ({ page }) => {
  await page.goto("/floresti");
  await expect(page.locator("h1")).toHaveText("Florești");
});

test("неизвестный город → 404", async ({ page }) => {
  const response = await page.goto("/chisinau");
  expect(response?.status()).toBe(404);
});
```

- [ ] **Step 2: Запустить — упасть** — `npx playwright test e2e/city-page.spec.ts` → 404 на /soroca.

- [ ] **Step 3: Реализация**

```tsx
// src/app/[city]/page.tsx
// Временная заглушка страницы города. Меню — следующая задача.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RememberCity } from "@/components/city/remember-city";
import { CITIES, getCity, isCitySlug } from "@/data/points";

type Props = { params: Promise<{ city: string }> };

// Все пять городов известны заранее — страницы статические.
export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }));
}
// Любой другой slug → 404, а не попытка отрендерить.
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  if (!isCitySlug(city)) return {};
  return { title: `Apetit ${getCity(city).name}` };
}

export default async function CityPage({ params }: Props) {
  const { city: slug } = await params;
  if (!isCitySlug(slug)) notFound();
  const city = getCity(slug);

  return (
    <main className="page flex min-h-dvh flex-col justify-center gap-4 py-16">
      <RememberCity slug={city.slug} />
      <h1 className="font-display text-city uppercase">{city.name}</h1>
      {/* Временно: меню появится в следующей задаче */}
      <p className="font-body text-body text-charcoal">[ТЕКСТ: меню скоро]</p>
    </main>
  );
}
```

```tsx
// src/components/city/remember-city.tsx
"use client";
// Запоминает город при открытии его страницы — так работает и клик по плитке,
// и прямая ссылка из Google, и «открыть в новой вкладке».
import { useEffect } from "react";
import type { CitySlug } from "@/data/points";
import { saveCity } from "@/lib/city-storage";

export function RememberCity({ slug }: { slug: CitySlug }) {
  useEffect(() => {
    saveCity(slug);
  }, [slug]);
  return null;
}
```

```ts
// src/lib/use-change-city.ts
"use client";
// «Сменить город»: забыть выбор и вернуться на экран городов.
// Кнопка появится в шапке (следующие задачи), здесь только логика.
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { clearCity } from "./city-storage";

export function useChangeCity(): () => void {
  const router = useRouter();
  return useCallback(() => {
    clearCity();
    router.push("/");
  }, [router]);
}
```

- [ ] **Step 4: Запустить — пройти** — 3 e2e-теста.

---

### Task 5: Экран городов `/` — плитки, анимация, редирект

**Files:**
- Create: `src/components/city/city-grid.tsx`
- Modify: `src/app/page.tsx` (заменить целиком)
- Modify: `playwright.config.ts` (viewport 390×844)
- Delete: `e2e/home.spec.ts` (проверял старую временную главную)
- Test: `e2e/city-screen.spec.ts`

**Interfaces:**
- Consumes: `CITIES` (Task 1), `buildCityRedirectScript` (Task 3).

- [ ] **Step 1: Падающий e2e-тест**

```ts
// e2e/city-screen.spec.ts
import { expect, test } from "@playwright/test";

const CITY_NAMES = ["Soroca", "Sculeni", "Florești", "Otaci", "Briceni"];

test("главная показывает 5 плиток и никакого другого текста", async ({ page }) => {
  await page.goto("/");
  const tiles = page.getByRole("link");
  await expect(tiles).toHaveCount(5);
  await expect(tiles).toHaveText(CITY_NAMES);
  // На экране больше нет никакого текста: ни заголовка, ни подписи, ни логотипа.
  const bodyText = await page.locator("body").innerText();
  expect(bodyText.split("\n").map((s) => s.trim()).filter(Boolean)).toEqual(CITY_NAMES);
});

test("плитки — ссылки на /[city]", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Otaci" })).toHaveAttribute("href", "/otaci");
});

test("клик по Soroca ведёт на /soroca, повторное открытие / редиректит туда же", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Soroca" }).click();
  await expect(page).toHaveURL("/soroca");
  await expect(page.locator("h1")).toHaveText("Soroca");

  await page.goto("/", { waitUntil: "commit" });
  await expect(page).toHaveURL("/soroca");
  await expect(page.locator("h1")).toHaveText("Soroca");
});

test("мусор в localStorage не ломает главную", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("apetit.city", "chisinau"));
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link")).toHaveCount(5);
});

test("prefers-reduced-motion: плитки видны без анимации", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const tile = page.getByRole("link", { name: "Briceni" });
  await expect(tile).toHaveCSS("opacity", "1");
  await expect(tile).toHaveCSS("transform", "none");
});
```

- [ ] **Step 2: Запустить — упасть** — `npx playwright test e2e/city-screen.spec.ts` → ссылок 0.

- [ ] **Step 3: Реализация**

```tsx
// src/components/city/city-grid.tsx
"use client";
// Пять плиток городов. Клиентский компонент из-за анимации входа (motion).
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { CITIES } from "@/data/points";

const MotionLink = motion.create(Link);

// Токены DESIGN.md → Motion: --ease-out и --dur-slow (420ms, экран городов).
const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;
const DURATION = 0.42;
const STAGGER = 0.06;

export function CityGrid() {
  const reduceMotion = useReducedMotion();

  return (
    <ul className="flex w-full flex-col gap-3 lg:flex-row lg:flex-wrap lg:justify-center">
      {CITIES.map((city, index) => (
        <li key={city.slug} className="lg:w-[200px]">
          <MotionLink
            href={`/${city.slug}`}
            className="city-tile"
            initial={reduceMotion ? false : { opacity: 0, transform: "translateY(24px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: DURATION, ease: EASE_OUT, delay: index * STAGGER }}
          >
            {city.name}
          </MotionLink>
        </li>
      ))}
    </ul>
  );
}
```

Стили плитки — в `globals.css` как утилита (значения из задачи архитектора; токен `--radius-tile` в DESIGN.md пока 24px, поэтому 16px задаём здесь и ждём обновлённый DESIGN.md):

```css
/* Плитка города (экран входа): без заливки, рамка Ink, 88px, Oswald 44px.
   Нажатие — заливка Ink, текст Cream, --dur-fast. */
@utility city-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88px;
  border: 1px solid var(--color-ink);
  border-radius: 16px;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: var(--text-city);
  line-height: var(--text-city--line-height);
  font-weight: var(--text-city--font-weight);
  letter-spacing: var(--text-city--letter-spacing);
  text-transform: uppercase;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      background-color: var(--color-milk);
    }
  }

  &:active {
    background-color: var(--color-ink);
    color: var(--color-cream);
  }

  &:focus-visible {
    outline: 2px solid var(--color-ink);
    outline-offset: 4px;
  }
}
```

```tsx
// src/app/page.tsx
// Экран городов (SPEC §3 шаг 1). Только пять плиток — без шапки, подвала,
// логотипа и текста.
import { CityGrid } from "@/components/city/city-grid";
import { buildCityRedirectScript } from "@/lib/city-redirect-script";

export default function Home() {
  return (
    <>
      {/* Редирект на сохранённый город до загрузки React — см. city-redirect-script.ts.
          Текст скрипта собирается из наших констант, пользовательских данных в нём нет. */}
      <script dangerouslySetInnerHTML={{ __html: buildCityRedirectScript() }} />
      <main className="page flex min-h-dvh items-center py-4">
        <CityGrid />
      </main>
    </>
  );
}
```

`playwright.config.ts`: в проекте `mobile-chromium` добавить `viewport: { width: 390, height: 844 }` после `...devices["Pixel 7"]`.

Удалить `e2e/home.spec.ts` (старая временная главная).

- [ ] **Step 4: Запустить — пройти** — `npm run test:e2e` → все e2e зелёные (city-page + city-screen).

---

### Task 6: Скриншоты 390 / 1280

**Files:**
- Create: `playwright.screenshots.config.ts`
- Create: `e2e-screens/city-screen.screens.ts`
- Modify: `package.json` — скрипт `"screens": "playwright test -c playwright.screenshots.config.ts"`
- Output: `docs/screens/01-orase-390.png`, `docs/screens/01-orase-1280.png`

- [ ] **Step 1: Конфиг**

```ts
// playwright.screenshots.config.ts
// Отдельный запуск для скриншотов в docs/screens — не входит в npm run test:e2e.
import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testDir: "./e2e-screens",
  testMatch: /.*\.screens\.ts/,
  fullyParallel: false,
  projects: [
    { name: "390", use: { ...devices["Pixel 7"], browserName: "chromium", viewport: { width: 390, height: 844 } } },
    { name: "1280", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
});
```

- [ ] **Step 2: Скрипт**

```ts
// e2e-screens/city-screen.screens.ts
import { test } from "@playwright/test";

test("скриншот экрана городов", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); // итоговое состояние без ожидания анимации
  await page.goto("/");
  await page.getByRole("link", { name: "Briceni" }).waitFor();
  await page.screenshot({ path: `docs/screens/01-orase-${testInfo.project.name}.png`, fullPage: false });
});
```

- [ ] **Step 3: Запустить** — `npm run screens` → два файла в `docs/screens/`. Открыть оба и глазами проверить: 5 плиток, рамки, Oswald, ничего лишнего.

---

### Task 7: Проверка, документация, коммит

- [ ] **Step 1:** `npm run lint` · `npm run build` · `npm test` · `npm run test:e2e` — всё зелёное.
- [ ] **Step 2:** Ревью по `web-design-guidelines` файлов `src/components/city/city-grid.tsx`, `src/app/page.tsx`, `src/app/[city]/page.tsx`, `src/app/globals.css` (утилита city-tile). Исправить найденное.
- [ ] **Step 3:** PROGRESS.md — отчёт: что сделано, решение по Next 16, расхождения с DESIGN.md, вопросы.
- [ ] **Step 4:** `git add -A && git commit -m "feat: city selection screen"` · `git push`.
