import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

const asMap = (isDev: boolean) =>
  Object.fromEntries(securityHeaders(isDev).map((h) => [h.key, h.value]));

/** «script-src 'self' …» → { "script-src": ["'self'", …] } */
function directives(csp: string): Record<string, string[]> {
  return Object.fromEntries(
    csp.split(";").map((d) => {
      const [name, ...sources] = d.trim().split(/\s+/);
      return [name, sources];
    }),
  );
}

describe("защитные заголовки (SPEC §9.4)", () => {
  it("все заголовки из задания — с точными значениями", () => {
    expect(asMap(false)).toMatchObject({
      "Strict-Transport-Security":
        "max-age=63072000; includeSubDomains; preload",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Permissions-Policy":
        "geolocation=(self), camera=(), microphone=(), payment=()",
    });
  });

  it("CSP: обязательные директивы из задания", () => {
    const d = directives(contentSecurityPolicy(false));
    expect(d["default-src"]).toEqual(["'self'"]);
    expect(d["img-src"]).toEqual(["'self'", "data:"]);
    expect(d["font-src"]).toEqual(["'self'"]);
    expect(d["frame-ancestors"]).toEqual(["'none'"]);
    expect(d["form-action"]).toEqual(["'self'"]);
    expect(d["base-uri"]).toEqual(["'self'"]);
    expect(d["object-src"]).toEqual(["'none'"]);
    expect(d["connect-src"]).toEqual(["'self'"]);
  });

  it("CSP: скрипты только свои; eval — только в разработке", () => {
    const prod = directives(contentSecurityPolicy(false));
    const dev = directives(contentSecurityPolicy(true));
    expect(prod["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    // Ни одного чужого домена и «разрешить всё»
    const all = Object.values(prod).flat().join(" ");
    expect(all).not.toMatch(/https?:|\*/);
  });

  it("рамка: боевой сайт — никому, в разработке — только свой адрес", () => {
    // Панель /dev/motion показывает страницу меню в <iframe> того же адреса
    expect(asMap(true)["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(directives(contentSecurityPolicy(true))["frame-ancestors"]).toEqual([
      "'self'",
    ]);
    expect(asMap(false)["X-Frame-Options"]).toBe("DENY");
    expect(directives(contentSecurityPolicy(false))["frame-ancestors"]).toEqual(
      ["'none'"],
    );
  });

  it("next.config не выдаёт движок сайта (X-Powered-By)", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("next.config отдаёт их на все адреса", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/:path*");
    const keys = rules[0].headers.map((h) => h.key);
    expect(keys).toEqual(securityHeaders(false).map((h) => h.key));
  });
});
