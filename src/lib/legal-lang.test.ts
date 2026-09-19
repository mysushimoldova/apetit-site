import { afterEach, describe, expect, it, vi } from "vitest";
import { CITY_STORAGE_KEY } from "./city-storage";
import {
  LEGAL_LANG_ATTR,
  buildLegalLangScript,
  chooseLegalLocale,
  getLegalLocale,
  localeForSavedCity,
  resetLegalLocaleForTests,
} from "./legal-lang";

// Исполняем скрипт по-настоящему, подменив localStorage и document.
function run(saved: string | null | (() => never)) {
  const attrs: Record<string, string> = {};
  const localStorage = {
    getItem: typeof saved === "function" ? saved : () => saved,
  };
  const document = {
    currentScript: {
      parentNode: {
        setAttribute: (k: string, v: string) => void (attrs[k] = v),
      },
    },
  };
  new Function("localStorage", "document", buildLegalLangScript())(
    localStorage,
    document,
  );
  return attrs[LEGAL_LANG_ATTR] ?? null;
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetLegalLocaleForTests();
});

describe("язык правовых страниц", () => {
  it("Otaci → ru, остальные города → ro, без города → ro", () => {
    expect(localeForSavedCity("otaci")).toBe("ru");
    expect(localeForSavedCity("soroca")).toBe("ro");
    expect(localeForSavedCity("briceni")).toBe("ro");
    expect(localeForSavedCity(null)).toBe("ro");
    expect(localeForSavedCity("chisinau")).toBe("ro");
  });

  it("скрипт до отрисовки: otaci → data-lang=ru, soroca → ro", () => {
    expect(run("otaci")).toBe("ru");
    expect(run("soroca")).toBe("ro");
  });

  it("скрипт: пусто, мусор или ошибка хранилища — атрибут не трогает", () => {
    expect(run(null)).toBeNull();
    expect(run("__proto__")).toBeNull();
    expect(run("toString")).toBeNull();
    expect(
      run(() => {
        throw new Error("SecurityError");
      }),
    ).toBeNull();
  });

  it("по сохранённому городу, пока не нажали переключатель", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => (k === CITY_STORAGE_KEY ? "otaci" : null),
      },
    });
    expect(getLegalLocale()).toBe("ru");
    chooseLegalLocale("ro");
    expect(getLegalLocale()).toBe("ro");
  });
});
