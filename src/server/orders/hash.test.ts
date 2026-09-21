import { describe, expect, it, vi } from "vitest";

describe("ipHash — HMAC с секретом, без секрета SHA-256 и одно предупреждение", () => {
  it("HMAC отличается от SHA-256 и зависит от секрета", async () => {
    const { hmacSha256Hex, sha256Hex } = await import("./hash");
    const plain = await sha256Hex("203.0.113.7");
    const a = await hmacSha256Hex("secret-a", "203.0.113.7");
    const b = await hmacSha256Hex("secret-b", "203.0.113.7");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(plain);
    expect(a).not.toBe(b);
    // Известный вектор: HMAC-SHA256("key", "The quick brown fox jumps over the lazy dog")
    expect(
      await hmacSha256Hex("key", "The quick brown fox jumps over the lazy dog"),
    ).toBe("f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
  });

  it("без секрета — SHA-256 и предупреждение ровно один раз на процесс", async () => {
    vi.resetModules();
    const { ipHash, sha256Hex } = await import("./hash");
    const warn = vi.fn();
    expect(await ipHash("203.0.113.7", undefined, warn)).toBe(
      await sha256Hex("203.0.113.7"),
    );
    await ipHash("203.0.113.8", "", warn);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain("ORDER_HASH_SECRET");
    // С секретом — предупреждения нет
    await ipHash("203.0.113.7", "s", warn);
    expect(warn).toHaveBeenCalledOnce();
  });
});
