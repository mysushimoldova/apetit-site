import { afterEach, describe, expect, it, vi } from "vitest";
import { LANG_STORAGE_KEY, getSavedLang, saveLang } from "./lang-storage";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("память выбранного языка", () => {
  it("ничего не сохранено → null", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage() });
    expect(getSavedLang()).toBeNull();
  });

  it("сохраняет и читает", () => {
    const s = fakeStorage();
    vi.stubGlobal("window", { localStorage: s });
    saveLang("ru");
    expect(s.data.get(LANG_STORAGE_KEY)).toBe("ru");
    expect(getSavedLang()).toBe("ru");
  });

  it("мусор в хранилище → null", () => {
    vi.stubGlobal("window", {
      localStorage: fakeStorage({ [LANG_STORAGE_KEY]: "en" }),
    });
    expect(getSavedLang()).toBeNull();
  });

  it("localStorage бросает → null и без ошибки", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("SecurityError");
      },
    });
    expect(getSavedLang()).toBeNull();
    expect(() => saveLang("ro")).not.toThrow();
  });

  it("на сервере (без window) — null", () => {
    vi.stubGlobal("window", undefined);
    expect(getSavedLang()).toBeNull();
  });
});
