import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "./zod";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)
      ? [path]
      : [];
  });
}

describe("zod без eval (CSP)", () => {
  it("jitless включён", () => {
    expect(z.config().jitless).toBe(true);
  });

  it("код сайта берёт zod только из src/lib/zod.ts", () => {
    const src = join(process.cwd(), "src");
    const direct = sourceFiles(src).filter(
      (f) =>
        !f.endsWith(join("lib", "zod.ts")) &&
        /from\s+["']zod["']/.test(readFileSync(f, "utf-8")),
    );
    expect(direct).toEqual([]);
  });
});
