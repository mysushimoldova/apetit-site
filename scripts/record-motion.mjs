// Запись движения сайта на видео — чтобы смотреть глазами, а не по описанию.
// Запуск: npm run motion
//
// Два прогона по одному и тому же сценарию, телефон 390×844 при двойной
// плотности точек:
//   docs/motion/ultima.webm    — как есть;
//   docs/motion/ultima-rm.webm — с системным «уменьшить движение».
// Оба файла в git не попадают (.gitignore): они переснимаются каждый раз.
//
// Сценарий (паузы по 400 мс, чтобы каждое движение было видно отдельно):
// меню Сорок → медленная прокрутка на три экрана → резкая остановка →
// вторая категория (заставка) → первый товар → закрыть → положить в корзину
// → открыть корзину → закрыть.
//
// Сервер берётся уже запущенный (localhost:3000); если его нет — скрипт
// поднимает свой `next dev` и гасит его в конце.
import { spawn } from "node:child_process";
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const PORT = Number(process.env.PORT ?? 3000);
const BASE = `http://localhost:${PORT}`;
const OUT_DIR = path.resolve("docs/motion");
const TMP_DIR = path.resolve("docs/motion/.record");

/** Пауза между шагами сценария, мс. */
const STEP = 400;

/** Прокрутка: пикселей за кадр и сколько экранов проехать. */
const SCROLL_STEP_PX = 12;
const SCREENS = 3;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function alive() {
  try {
    const response = await fetch(BASE, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function startServer() {
  if (await alive()) {
    console.log(`Сервер на ${BASE} уже работает — пишу с него.`);
    return null;
  }
  console.log(`Поднимаю dev-сервер на ${PORT}…`);
  // Запускаем сам node по файлу next, а не npx: Node 24 на Windows
  // отказывается запускать .cmd без оболочки (spawn EINVAL), а оболочка
  // склеивает аргументы в строку — лишний повод для ошибок с пробелами.
  const bin = fileURLToPath(
    new URL("../node_modules/next/dist/bin/next", import.meta.url),
  );
  const child = spawn(process.execPath, [bin, "dev", "-p", String(PORT)], {
    stdio: "ignore",
  });
  for (let i = 0; i < 120; i++) {
    if (await alive()) return child;
    await wait(1000);
  }
  child.kill();
  throw new Error("Сервер не поднялся за две минуты");
}

/** Погасить свой сервер. На Windows одного kill мало: npx запускает next
 *  отдельным процессом, и тот остался бы висеть на порту. */
function stopServer(child) {
  if (process.platform !== "win32") {
    child.kill();
    return;
  }
  spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
    stdio: "ignore",
  });
}

/** Медленная прокрутка «как пальцем»: ровно по SCROLL_STEP_PX за кадр. */
async function slowScroll(page, screens) {
  await page.evaluate(
    async ([stepPx, count]) => {
      const total = window.innerHeight * count;
      let done = 0;
      while (done < total) {
        window.scrollBy(0, stepPx);
        done += stepPx;
        await new Promise((r) => requestAnimationFrame(r));
      }
    },
    [SCROLL_STEP_PX, screens],
  );
}

async function record(name, reducedMotion) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: reducedMotion ? "reduce" : "no-preference",
    recordVideo: { dir: TMP_DIR, size: { width: 390, height: 844 } },
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/soroca`, { waitUntil: "load" });
  // Движок подключается после показа страницы
  await page.locator("canvas.motion-canvas").waitFor({ state: "attached" });
  await wait(1200);

  // 1. Медленная прокрутка на три экрана и резкая остановка
  await slowScroll(page, SCREENS);
  await wait(STEP);

  // 2. Вторая категория: заставка играет с первого нажатия — пока шла
  //    прокрутка, ролики тихо догрузились (src/motion/splash/videos.ts)
  const chips = page.locator(".chips-row a");
  await chips.nth(2).click();
  await wait(2200);

  // 3. Первый товар: открыть и закрыть
  const tile = page.locator("[data-reveal] .tile-open").first();
  if (await tile.count()) {
    await tile.click();
    await wait(1000);
    await page.keyboard.press("Escape");
    await wait(STEP + 400);
  }

  // 4. Положить в корзину, открыть её и закрыть
  const add = page.locator("[data-reveal] .add-button").first();
  if (await add.count()) {
    await add.click();
    await wait(STEP);
  }
  const cart = page.locator(".cart-bar button").first();
  if (await cart.count()) {
    await cart.click();
    await wait(1200);
    await page.keyboard.press("Escape");
    await wait(STEP + 400);
  }

  const video = page.video();
  await context.close();
  await browser.close();
  if (!video) throw new Error("Playwright не записал видео");

  const target = path.join(OUT_DIR, name);
  await rm(target, { force: true });
  await rename(await video.path(), target);
  console.log(`Записано: ${target}`);
}

const server = await startServer();
try {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(TMP_DIR, { recursive: true });
  await record("ultima.webm", false);
  await record("ultima-rm.webm", true);
} finally {
  // Временную папку Playwright убираем — файлы уже переименованы
  const left = await readdir(TMP_DIR).catch(() => []);
  if (left.length === 0) await rm(TMP_DIR, { recursive: true, force: true });
  if (server) stopServer(server);
}
