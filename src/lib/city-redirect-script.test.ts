import { describe, expect, it } from "vitest";
import type { Locale } from "@/data/points";
import { buildCityRedirectScript } from "./city-redirect-script";
import { CITY_STORAGE_KEY } from "./city-storage";
import { LANG_STORAGE_KEY } from "./lang-storage";

type Saved = Record<string, string | null> | (() => never);

// Исполняем скрипт по-настоящему, подменив только localStorage и location.
function run(saved: Saved, locale: Locale = "ro") {
  const replaced: string[] = [];
  const localStorage = {
    getItem:
      typeof saved === "function" ? saved : (k: string) => saved[k] ?? null,
  };
  const location = { replace: (url: string) => void replaced.push(url) };
  new Function("localStorage", "location", buildCityRedirectScript(locale))(
    localStorage,
    location,
  );
  return replaced;
}

const city = (slug: string, lang: string | null = null) => ({
  [CITY_STORAGE_KEY]: slug,
  [LANG_STORAGE_KEY]: lang,
});

describe("inline-скрипт редиректа на сохранённый город", () => {
  it("сохранён soroca → location.replace('/soroca')", () => {
    expect(run(city("soroca"))).toEqual(["/soroca"]);
  });

  it("Otaci без выбранного языка → /ru/otaci", () => {
    expect(run(city("otaci"))).toEqual(["/ru/otaci"]);
  });

  it("выбранный язык важнее языка города", () => {
    expect(run(city("otaci", "ro"))).toEqual(["/otaci"]);
    expect(run(city("soroca", "ru"))).toEqual(["/ru/soroca"]);
  });

  it("мусор в языке — как будто не выбран", () => {
    expect(run(city("soroca", "en"))).toEqual(["/soroca"]);
    expect(run(city("otaci", "en"))).toEqual(["/ru/otaci"]);
  });

  it("на «/ru» — всегда русский адрес", () => {
    expect(run(city("soroca"), "ru")).toEqual(["/ru/soroca"]);
    expect(run(city("soroca", "ro"), "ru")).toEqual(["/ru/soroca"]);
  });

  it("ничего не сохранено → без редиректа", () => {
    expect(run({})).toEqual([]);
    expect(run({ [LANG_STORAGE_KEY]: "ru" })).toEqual([]);
  });

  it("мусор в городе → без редиректа", () => {
    expect(run(city("chisinau"))).toEqual([]);
    expect(run(city("soroca/../admin"))).toEqual([]);
    expect(run(city(""))).toEqual([]);
  });

  it("localStorage бросает → скрипт не падает", () => {
    expect(() =>
      run(() => {
        throw new Error("SecurityError");
      }),
    ).not.toThrow();
  });

  it("использует те же ключи, что и хранилища", () => {
    const script = buildCityRedirectScript("ro");
    expect(script).toContain(CITY_STORAGE_KEY);
    expect(script).toContain(LANG_STORAGE_KEY);
  });
});
