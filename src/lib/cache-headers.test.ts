import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { cacheRules, HTML_CACHE, IMMUTABLE, NO_STORE } from "./cache-headers";

describe("правила кеша", () => {
  it("три срока жизни: страницы, неизменяемые файлы, API", () => {
    expect(IMMUTABLE).toBe("public, max-age=31536000, immutable");
    expect(NO_STORE).toBe("no-store");
    // Решение архитектора 24.09.2026: у браузера страница не живёт совсем,
    // у Cloudflare — минуту, плюс пять минут отдачи старой копии, пока
    // берётся свежая
    expect(HTML_CACHE).toBe(
      "public, max-age=0, must-revalidate, s-maxage=60, stale-while-revalidate=300",
    );
  });

  it("правила идут в том же порядке и не пересекаются", () => {
    const rules = cacheRules();
    expect(rules.map((r) => r.source)).toEqual([
      "/:path((?!_next|img|splash|api).*)",
      "/img/:path*",
      "/splash/:path*",
      "/_next/static/:path*",
      "/api/:path*",
    ]);
    const value = (source: string) =>
      rules.find((r) => r.source === source)!.headers;
    expect(value("/:path((?!_next|img|splash|api).*)")).toEqual([
      { key: "Cache-Control", value: HTML_CACHE },
    ]);
    for (const source of [
      "/img/:path*",
      "/splash/:path*",
      "/_next/static/:path*",
    ]) {
      expect(value(source), source).toEqual([
        { key: "Cache-Control", value: IMMUTABLE },
      ]);
    }
    expect(value("/api/:path*")).toEqual([
      { key: "Cache-Control", value: NO_STORE },
    ]);
  });

  // Главное, ради чего правило для страниц записано через «кроме»: ни один
  // адрес не должен попасть под два правила сразу — иначе в ответе окажется
  // два разных Cache-Control, и какой из них послушает Cloudflare, не знает
  // никто.
  it("страница и файл никогда не попадают под одно и то же правило", () => {
    const html = new RegExp("^/(?!_next|img|splash|api).*$");
    for (const path of [
      "/",
      "/soroca",
      "/ru/soroca/comanda",
      "/contacte",
      "/robots.txt",
    ]) {
      expect(html.test(path), path).toBe(true);
    }
    for (const path of [
      "/_next/static/chunks/a.js",
      "/img/products/kebab-400.webp",
      "/splash/cola.mp4",
      "/api/telegram/webhook",
    ]) {
      expect(html.test(path), path).toBe(false);
    }
  });

  // На Cloudflare файлы (сборка, фото, ролики) отдаёт не наш код, а сам
  // Cloudflare, и правила из next.config до них не доходят: им задаёт
  // заголовки public/_headers. Значения обязаны совпадать — иначе фото
  // молча начнут качаться заново при каждом заходе.
  it("public/_headers держит тот же год для тех же файлов", () => {
    const text = readFileSync(
      path.join(process.cwd(), "public", "_headers"),
      "utf8",
    );
    const rule = new RegExp("^(/\\S+)\\r?\\n\\s+Cache-Control:\\s*(.+)$", "gm");
    const blocks = [...text.matchAll(rule)];
    expect(Object.fromEntries(blocks.map((m) => [m[1], m[2].trim()]))).toEqual({
      "/_next/static/*": IMMUTABLE,
      "/img/*": IMMUTABLE,
      "/splash/*": IMMUTABLE,
    });
  });

  it("правила подключены в next.config", async () => {
    const rules = await nextConfig.headers!();
    const sources = rules.map((r) => r.source);
    for (const source of cacheRules().map((r) => r.source)) {
      expect(sources).toContain(source);
    }
  });
});
