import { expect, test, type APIRequestContext } from "@playwright/test";

// Сроки жизни кеша (решение архитектора 24.09.2026). Один и тот же список
// проверяется и на обычной боевой сборке (npm run test:e2e:prod), и на
// сборке для Cloudflare (npm run test:e2e:cf) — заголовки обязаны совпадать
// в обеих средах, иначе «как у нас» и «как у людей» разъезжаются.

const HTML =
  "public, max-age=0, must-revalidate, s-maxage=60, stale-while-revalidate=300";
const IMMUTABLE = "public, max-age=31536000, immutable";

async function cacheControl(
  request: APIRequestContext,
  path: string,
): Promise<string> {
  const response = await request.get(path);
  return response.headers()["cache-control"] ?? "(нет заголовка)";
}

test("страницы: браузер не кеширует, Cloudflare — минуту", async ({
  request,
}) => {
  for (const path of [
    "/",
    "/soroca",
    "/ru/soroca",
    "/soroca/comanda",
    "/contacte",
    "/termeni",
    "/robots.txt",
    "/sitemap.xml",
  ]) {
    expect(await cacheControl(request, path), path).toBe(HTML);
  }
});

test("сборка, фото и ролики заставки — год и неизменяемо", async ({
  request,
}) => {
  // Адрес фото берём со страницы меню: имена файлов пересчитываются сборкой
  const menu = await (await request.get("/soroca")).text();
  const image = menu.match(/\/img\/products\/[a-z0-9-]+-\d+\.webp/)?.[0];
  expect(image, "на странице меню нет ни одного фото").toBeTruthy();
  const chunk = menu.match(/\/_next\/static\/[^"']+\.js/)?.[0];
  expect(chunk, "на странице нет ни одного файла сборки").toBeTruthy();

  for (const path of [image!, chunk!, "/splash/cola.mp4"]) {
    expect(await cacheControl(request, path), path).toBe(IMMUTABLE);
  }
});

test("API не кешируется вовсе", async ({ request }) => {
  const response = await request.post("/api/telegram/reminders", {
    // Только латиница: в значение заголовка HTTP другого и не положишь
    headers: { "x-reminders-secret": "not-the-secret" },
    data: {},
  });
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toBe("no-store");
});

test("страница «не найдено» не кешируется", async ({ request }) => {
  const response = await request.get("/nu-exista-asa-pagina");
  expect(response.status()).toBe(404);
  expect(response.headers()["cache-control"]).toContain("no-store");
});
