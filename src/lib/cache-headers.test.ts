import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { IMMUTABLE, immutableCacheRules, NO_STORE } from "./cache-headers";

describe("долгий кэш неизменяемых файлов", () => {
  it("год и immutable для /img, /splash и /_next/static", () => {
    expect(IMMUTABLE).toBe("public, max-age=31536000, immutable");
    expect(immutableCacheRules().map((r) => r.source)).toEqual([
      "/img/:path*",
      "/splash/:path*",
      "/_next/static/:path*",
      "/api/:path*",
    ]);
    for (const rule of immutableCacheRules()) {
      const value = rule.source.startsWith("/api") ? NO_STORE : IMMUTABLE;
      expect(rule.headers).toEqual([{ key: "Cache-Control", value }]);
    }
  });

  it("правила подключены в next.config", async () => {
    const rules = await nextConfig.headers!();
    const sources = rules.map((r) => r.source);
    expect(sources).toContain("/img/:path*");
    expect(sources).toContain("/splash/:path*");
    expect(sources).toContain("/_next/static/:path*");
    expect(sources).toContain("/api/:path*");
  });
});
