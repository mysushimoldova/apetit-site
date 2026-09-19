"""Подготовка фото блюд: вырезка без фона → WebP 400/800/1600 + мастер-PNG,
манифест src/data/images.json и контрольный лист docs/screens/02-produse-sheet.png.

Запуск (из корня проекта):
    py -3 scripts/prepare-images.py            # только новые/изменённые файлы
    py -3 scripts/prepare-images.py --force    # пересчитать всё
    py -3 scripts/prepare-images.py --only kebab-cheese gozleme-carne
    py -3 scripts/prepare-images.py --sheet-only   # только контрольный лист

Правила:
- PNG с настоящей прозрачностью → только обрезка пустых полей;
- JPG и PNG без прозрачности → rembg с alpha matting на копии не длиннее
  2048px (isnet-general-use; при флагах качества — повтор через
  birefnet-general-lite), маска поднимается до исходного размера;
- мастер <slug>.png в исходном размере (не в git), WebP quality 82;
- повторный запуск ничего не пересчитывает, если исходник не менялся
  (sha1 исходника хранится в манифесте).
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prepare_images_lib import (  # noqa: E402
    QUALITY,
    WORK_LONG_SIDE,
    has_real_alpha,
    iter_sources,
    quality_flags,
    sha1_file,
    size_ladder,
    slug_from_path,
    trim_alpha,
)

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "assets" / "foto-originale"
OUT_DIR = ROOT / "public" / "img" / "products"
MANIFEST = ROOT / "src" / "data" / "images.json"
SHEET = ROOT / "docs" / "screens" / "02-produse-sheet.png"

# Цепочка моделей: первая — основная; если её вырезка получает флаги
# качества (дырки, полупрозрачная белая посуда), пробуем следующую и
# оставляем результат с меньшим числом флагов. Обе модели — MIT, качаются сами.
REMBG_MODELS = ("isnet-general-use", "birefnet-general-lite")
# Версия пайплайна: поднять, если поменялись параметры вырезки — тогда всё
# пересчитается при следующем запуске без --force.
PIPELINE = 2

Image.MAX_IMAGE_PIXELS = None  # исходники 12 Мп — это нормально


# ---------------------------------------------------------------- rembg ----
_sessions: dict[str, object] = {}


def rembg_session(model: str):
    """rembg импортируется лениво: если пересчитывать нечего, скрипт не
    тратит секунды на загрузку onnxruntime."""
    if model not in _sessions:
        from rembg import new_session

        _sessions[model] = new_session(model)
    return _sessions[model]


def cut_out_with_rembg(im: Image.Image, model: str) -> Image.Image:
    """Убрать фон: маска на уменьшенной копии, наложение на оригинал."""
    from rembg import remove

    rgb = im.convert("RGB")
    scale = min(1.0, WORK_LONG_SIDE / max(rgb.size))
    work = rgb if scale == 1.0 else rgb.resize(
        (round(rgb.width * scale), round(rgb.height * scale)), Image.LANCZOS
    )
    cut = remove(
        work,
        session=rembg_session(model),
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=10,
    )
    alpha = cut.getchannel("A")
    if alpha.size != rgb.size:
        alpha = alpha.resize(rgb.size, Image.LANCZOS)
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def best_cut_out(im: Image.Image) -> tuple[Image.Image, list[str], str]:
    """Прогнать модели по цепочке, пока вырезка не станет чистой."""
    best: tuple[Image.Image, list[str], str] | None = None
    for model in REMBG_MODELS:
        cut = trim_alpha(cut_out_with_rembg(im, model))
        flags = quality_flags(np.asarray(cut.getchannel("A")))
        if best is None or len(flags) < len(best[1]):
            best = (cut, flags, model)
        if not flags:
            break
    assert best is not None
    return best


# ------------------------------------------------------------- manifest ----
def load_manifest() -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text("utf-8"))
    return {"generatedBy": "scripts/prepare-images.py", "pipeline": PIPELINE, "products": {}}


def save_manifest(manifest: dict) -> None:
    manifest["generatedBy"] = "scripts/prepare-images.py"
    manifest["pipeline"] = PIPELINE
    manifest["products"] = dict(sorted(manifest["products"].items()))
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", "utf-8"
    )


def outputs_for(slug: str, sizes: list[int]) -> list[Path]:
    return [OUT_DIR / f"{slug}.png"] + [OUT_DIR / f"{slug}-{w}.webp" for w in sizes]


def is_up_to_date(entry: dict | None, source_hash: str, pipeline: int) -> bool:
    if not entry or entry.get("sourceHash") != source_hash or pipeline != PIPELINE:
        return False
    return all(p.exists() for p in outputs_for(entry["slug"], entry["sizes"]))


# -------------------------------------------------------------- process ----
def process_one(src: Path) -> dict:
    slug = slug_from_path(src)
    im = Image.open(src)
    im.load()
    if has_real_alpha(im):
        method, model, flags = "alpha", None, []
        cut = trim_alpha(im.convert("RGBA"))
    else:
        method = "rembg"
        cut, flags, model = best_cut_out(im)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cut.save(OUT_DIR / f"{slug}.png", optimize=False)
    sizes = size_ladder(cut.width)
    for w in sizes:
        h = round(cut.height * w / cut.width)
        cut.resize((w, h), Image.LANCZOS).save(
            OUT_DIR / f"{slug}-{w}.webp", quality=QUALITY, method=6
        )

    return {
        "slug": slug,
        "source": src.name,
        "sourceHash": sha1_file(src),
        "method": method,
        "model": model,
        "width": cut.width,
        "height": cut.height,
        "sizes": sizes,
        "flags": flags,
    }


# ---------------------------------------------------------------- sheet ----
CREAM = (250, 247, 242)
INK = (26, 23, 20)
CLOSED = (201, 71, 58)
CELL_W, CELL_H, CAPTION_H, COLS = 300, 300, 36, 6


def caption_font(size: int = 16) -> ImageFont.ImageFont:
    for name in ("segoeui.ttf", "arial.ttf"):
        p = Path("C:/Windows/Fonts") / name
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def build_sheet(manifest: dict) -> None:
    """Все вырезки на Cream, по 6 в ряд, подпись slug (красная — с флагами)."""
    products = list(manifest["products"].values())
    rows = (len(products) + COLS - 1) // COLS
    sheet = Image.new(
        "RGB", (COLS * CELL_W, rows * (CELL_H + CAPTION_H)), CREAM
    )
    draw = ImageDraw.Draw(sheet)
    font = caption_font()
    for i, p in enumerate(products):
        col, row = i % COLS, i // COLS
        x0, y0 = col * CELL_W, row * (CELL_H + CAPTION_H)
        w = min(p["sizes"]) if p["sizes"] else None
        thumb_path = OUT_DIR / (f"{p['slug']}-{w}.webp" if w else f"{p['slug']}.png")
        thumb = Image.open(thumb_path).convert("RGBA")
        thumb.thumbnail((CELL_W - 24, CELL_H - 24), Image.LANCZOS)
        px = x0 + (CELL_W - thumb.width) // 2
        py = y0 + (CELL_H - thumb.height) // 2
        sheet.paste(thumb, (px, py), thumb)
        label = p["slug"] + (f"  [{', '.join(p['flags'])}]" if p["flags"] else "")
        color = CLOSED if p["flags"] else INK
        draw.text((x0 + 12, y0 + CELL_H + 6), label, fill=color, font=font)
    SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(SHEET, optimize=True)


# ----------------------------------------------------------------- main ----
def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--force", action="store_true", help="пересчитать всё")
    ap.add_argument("--only", nargs="+", metavar="SLUG", help="только эти slug")
    ap.add_argument("--sheet-only", action="store_true", help="только контрольный лист")
    args = ap.parse_args(argv)

    manifest = load_manifest()
    products: dict[str, dict] = manifest["products"]

    if not args.sheet_only:
        sources = iter_sources(SRC_DIR)
        if args.only:
            sources = [s for s in sources if slug_from_path(s) in set(args.only)]
        processed = skipped = 0
        started = time.time()
        for src in sources:
            slug = slug_from_path(src)
            source_hash = sha1_file(src)
            entry = products.get(slug)
            if not args.force and is_up_to_date(entry, source_hash, manifest.get("pipeline")):
                skipped += 1
                continue
            t0 = time.time()
            try:
                products[slug] = process_one(src)
            except Exception as e:  # битый файл — сообщаем и идём дальше
                print(f"  !! {src.name}: {e}", file=sys.stderr)
                continue
            processed += 1
            p = products[slug]
            note = f"  [{', '.join(p['flags'])}]" if p["flags"] else ""
            print(
                f"  {slug:36s} {p['method']:5s} {(p['model'] or ''):22s}"
                f" {p['width']}x{p['height']}  {time.time() - t0:5.1f}s{note}",
                flush=True,
            )
        # Записи, у которых исчез исходник, — убрать (только при полном прогоне)
        if not args.only:
            existing = {slug_from_path(s) for s in iter_sources(SRC_DIR)}
            for slug in list(products):
                if slug not in existing:
                    del products[slug]
        save_manifest(manifest)
        flagged = [s for s, p in products.items() if p["flags"]]
        print(
            f"processed {processed}, skipped {skipped}, total {len(products)},"
            f" flagged {len(flagged)}, {time.time() - started:.0f}s"
        )
        if flagged:
            print("flagged: " + ", ".join(flagged))

    build_sheet(manifest)
    print(f"sheet: {SHEET.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
