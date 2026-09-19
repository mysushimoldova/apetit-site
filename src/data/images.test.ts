import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Манифест создаёт scripts/prepare-images.py. Здесь проверяем, что он валиден
// и что все файлы, на которые он ссылается, лежат в public/img/products.
const ROOT = join(__dirname, "..", "..");
const MANIFEST = join(ROOT, "src", "data", "images.json");
const OUT_DIR = join(ROOT, "public", "img", "products");
const SHEET = join(ROOT, "docs", "screens", "02-produse-sheet.png");
const WIDTHS = [400, 800, 1600];

interface Product {
  slug: string;
  source: string;
  sourceHash: string;
  method: "alpha" | "rembg";
  model: string | null;
  width: number;
  height: number;
  sizes: number[];
  flags: string[];
}

function readManifest(): { products: Record<string, Product> } {
  return JSON.parse(readFileSync(MANIFEST, "utf-8"));
}

describe("манифест фото (src/data/images.json)", () => {
  const { products } = readManifest();
  const slugs = Object.keys(products);

  it("не пустой и без служебных файлов", () => {
    expect(slugs.length).toBeGreaterThan(0);
    expect(slugs).not.toContain("desktop");
    expect(slugs).not.toContain("le-coq-margarita-mojito");
  });

  it("ключи отсортированы и совпадают со slug внутри записи", () => {
    expect(slugs).toEqual([...slugs].sort());
    for (const slug of slugs) expect(products[slug].slug).toBe(slug);
  });

  it("у каждой записи размеры > 0, метод alpha|rembg, хэш исходника", () => {
    for (const p of Object.values(products)) {
      expect(p.width, p.slug).toBeGreaterThan(0);
      expect(p.height, p.slug).toBeGreaterThan(0);
      expect(["alpha", "rembg"], p.slug).toContain(p.method);
      // rembg → какая модель вырезала; alpha (готовая прозрачность) → null
      if (p.method === "rembg") expect(p.model, p.slug).toMatch(/^[a-z0-9-]+$/);
      else expect(p.model, p.slug).toBeNull();
      expect(p.sourceHash, p.slug).toMatch(/^[0-9a-f]{40}$/);
      expect(Array.isArray(p.flags), p.slug).toBe(true);
    }
  });

  it("sizes — только 400/800/1600 без апскейла, файлы WebP на месте и не пустые", () => {
    for (const p of Object.values(products)) {
      expect(p.sizes.length, p.slug).toBeGreaterThan(0);
      for (const w of p.sizes) {
        expect(WIDTHS, p.slug).toContain(w);
        expect(w, p.slug).toBeLessThanOrEqual(p.width);
        const file = join(OUT_DIR, `${p.slug}-${w}.webp`);
        expect(existsSync(file), file).toBe(true);
        expect(statSync(file).size, file).toBeGreaterThan(0);
      }
    }
  });

  it("в public/img/products нет WebP-сирот без записи в манифесте", () => {
    const orphans = readdirSync(OUT_DIR)
      .filter((f) => f.endsWith(".webp"))
      .filter((f) => !slugs.some((s) => f.startsWith(`${s}-`)));
    expect(orphans).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Идемпотентность: повторный запуск скрипта ничего не меняет байт в байт.
// Нужен Python (py -3 на Windows); если его нет — тест пропускается.
function pythonLauncher(): string[] | null {
  for (const cmd of [["py", "-3"], ["python3"], ["python"]]) {
    const r = spawnSync(cmd[0], [...cmd.slice(1), "--version"], {
      encoding: "utf-8",
    });
    if (r.status === 0 && /Python 3/.test(r.stdout + r.stderr)) return cmd;
  }
  return null;
}

function snapshotOutputs(): Record<string, string> {
  const files = readdirSync(OUT_DIR).sort();
  const hashes: Record<string, string> = {};
  for (const f of files) {
    hashes[f] = createHash("sha1")
      .update(readFileSync(join(OUT_DIR, f)))
      .digest("hex");
  }
  hashes["images.json"] = createHash("sha1")
    .update(readFileSync(MANIFEST))
    .digest("hex");
  // Контрольный лист тоже не должен меняться от запуска к запуску
  hashes["02-produse-sheet.png"] = createHash("sha1")
    .update(readFileSync(SHEET))
    .digest("hex");
  return hashes;
}

const launcher = pythonLauncher();

describe.skipIf(!launcher)("scripts/prepare-images.py", () => {
  it("повторный запуск идемпотентен: processed 0, файлы и манифест без изменений", () => {
    const before = snapshotOutputs();
    const r = spawnSync(
      launcher![0],
      [...launcher!.slice(1), "scripts/prepare-images.py"],
      { cwd: ROOT, encoding: "utf-8" },
    );
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/processed 0, skipped \d+/);
    expect(snapshotOutputs()).toEqual(before);
  }, 120_000);
});
