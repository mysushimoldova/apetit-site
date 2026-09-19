import { describe, expect, it } from "vitest";
import { buildCityRedirectScript } from "./city-redirect-script";
import { CITY_STORAGE_KEY } from "./city-storage";

// Исполняем скрипт по-настоящему, подменив только localStorage и location.
function run(saved: string | null | (() => never)) {
  const replaced: string[] = [];
  const localStorage = {
    getItem: typeof saved === "function" ? saved : () => saved,
  };
  const location = { replace: (url: string) => void replaced.push(url) };
  new Function("localStorage", "location", buildCityRedirectScript())(
    localStorage,
    location,
  );
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
