import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeFileAtomic } from "./write-file-atomic";

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "apetit-atomic-"));
  file = path.join(dir, "motion.json");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("writeFileAtomic", () => {
  it("создаёт файл и пишет содержимое", async () => {
    await writeFileAtomic(file, "привет\n");
    expect(await readFile(file, "utf8")).toBe("привет\n");
  });

  it("короткая запись не оставляет хвост от длинной", async () => {
    const long = `${"x".repeat(500)}\n`;
    await writeFileAtomic(file, long);
    await writeFileAtomic(file, "коротко\n");
    expect(await readFile(file, "utf8")).toBe("коротко\n");
  });

  it("две одновременные записи: файл целиком одной из них, не смесь", async () => {
    const a = `${JSON.stringify({ a: 1, длинное: "y".repeat(400) })}\n`;
    const b = `${JSON.stringify({ b: 2 })}\n`;
    await Promise.all([
      writeFileAtomic(file, a),
      writeFileAtomic(file, b),
      writeFileAtomic(file, a),
      writeFileAtomic(file, b),
    ]);
    const text = await readFile(file, "utf8");
    expect([a, b]).toContain(text);
    // И разбирается как JSON — именно это ломалось раньше
    expect(() => JSON.parse(text)).not.toThrow();
  });

  it("временных файлов после записи не остаётся", async () => {
    await writeFileAtomic(file, "раз\n");
    await writeFileAtomic(file, "два\n");
    expect(await readdir(dir)).toEqual(["motion.json"]);
  });

  it("запись не удалась — старый файл цел, мусора нет", async () => {
    await writeFile(file, "старое\n", "utf8");
    // Папки нет → и запись временного файла, и переименование невозможны
    const missing = path.join(dir, "нет-такой-папки", "motion.json");
    await expect(writeFileAtomic(missing, "новое\n")).rejects.toThrow();
    expect(await readFile(file, "utf8")).toBe("старое\n");
    expect(await readdir(dir)).toEqual(["motion.json"]);
  });
});
