import { describe, expect, it } from "vitest";
import { PAGE_BACKGROUNDS } from "@/motion/config-schema";
import { applyPageTheme, pageThemeVars } from "./page-theme";

describe("цвет фона страницы", () => {
  it("даёт три переменные: сам цвет и два стекла от него же", () => {
    expect(pageThemeVars("#F1E9DB")).toEqual({
      "--color-cream": "#F1E9DB",
      "--glass-bg": "rgba(241, 233, 219, 0.78)",
      "--glass-bg-fallback": "rgba(241, 233, 219, 0.96)",
    });
  });

  it("вариант A даёт ровно то, что было в globals.css до задачи", () => {
    const vars = pageThemeVars("#FAF7F2");
    expect(vars["--glass-bg"]).toBe("rgba(250, 247, 242, 0.78)");
    expect(vars["--glass-bg-fallback"]).toBe("rgba(250, 247, 242, 0.96)");
  });

  it("все четыре варианта разбираются", () => {
    for (const hex of Object.keys(PAGE_BACKGROUNDS)) {
      expect(pageThemeVars(hex)["--glass-bg"]).toMatch(
        /^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, 0\.78\)$/,
      );
    }
  });

  it("применяется к элементу — это нужно панели /dev/motion", () => {
    // Настоящего браузера в юнит-тестах нет: подставляем то же, что делает
    // <html> — приём значений в style.setProperty
    const set = new Map<string, string>();
    applyPageTheme(
      { style: { setProperty: (n, v) => void set.set(n, v) } },
      "#F4EDE2",
    );
    expect(set.get("--color-cream")).toBe("#F4EDE2");
    expect(set.get("--glass-bg")).toBe("rgba(244, 237, 226, 0.78)");
  });
});
