"""Чистые функции пайплайна фото блюд (без rembg — их можно тестировать
быстро на синтетических картинках). Используется из prepare-images.py.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

# Файлы, которые не являются фото блюд (решение архитектора).
SKIP_FILES = {"desktop.ini", "le-coq-margarita-mojito.png"}
SOURCE_SUFFIXES = {".png", ".jpg", ".jpeg"}

# Ширины WebP (DESIGN.md → Imagery: 400 / 800 / 1600) и качество.
WIDTHS = (400, 800, 1600)
QUALITY = 82
# Самая мелкая версия сжимается плотнее: на плитке ~170px разницы не видно,
# а первый экран меню весит меньше (решение архитектора — качество 400-й
# версии не выше 80).
QUALITY_BY_WIDTH = {400: 80}


def quality_for(width: int) -> int:
    """Качество WebP для ширины."""
    return QUALITY_BY_WIDTH.get(width, QUALITY)

# rembg считает маску на копии не длиннее этого (модель всё равно работает
# на 1024px, а матирование на 12 Мп заняло бы минуты на файл).
WORK_LONG_SIDE = 2048

# Пиксели с alpha ≤ этого порога считаем пустыми при обрезке (шум матирования).
TRIM_THRESHOLD = 8


def slug_from_path(p: Path) -> str:
    """Имя файла = slug блюда (CLAUDE.md)."""
    return p.stem.lower()


def iter_sources(src_dir: Path) -> list[Path]:
    """Все фото в папке по алфавиту, без служебных и пропущенных файлов."""
    return sorted(
        p
        for p in src_dir.iterdir()
        if p.is_file()
        and p.suffix.lower() in SOURCE_SUFFIXES
        and p.name not in SKIP_FILES
    )


def has_real_alpha(im: Image.Image) -> bool:
    """Есть ли в картинке настоящая прозрачность (а не просто RGBA-режим)."""
    if "A" not in im.getbands():
        return False
    alpha = np.asarray(im.getchannel("A"))
    return bool((alpha < 250).any())


def trim_alpha(im: Image.Image, threshold: int = TRIM_THRESHOLD) -> Image.Image:
    """Обрезать пустые поля: bbox пикселей с alpha > threshold."""
    im = im.convert("RGBA")
    alpha = np.asarray(im.getchannel("A"))
    mask = alpha > threshold
    if not mask.any():
        return im
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    box = (int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1)
    return im.crop(box)


def size_ladder(width: int) -> list[int]:
    """Какие ширины WebP делать: только те, что не требуют апскейла."""
    return [w for w in WIDTHS if w <= width]


def quality_flags(alpha: np.ndarray) -> list[str]:
    """Эвристики «плохой вырезки» по альфа-каналу (уже обрезанному).

    - low-coverage: непрозрачных пикселей в bbox слишком мало — маска
      рассыпалась на крошки;
    - holes: внутри фигуры есть прозрачные «дырки» — rembg съел светлый
      лаваш или сыр;
    - soft-edges: слишком много полупрозрачных пикселей — размытый край.
    """
    flags: list[str] = []
    h, w = alpha.shape
    total = h * w
    if total == 0:
        return ["empty"]

    opaque = alpha > 128
    coverage = opaque.mean()
    if coverage < 0.15:
        flags.append("low-coverage")

    # Дырки: заливаем «снаружи» с рамки в 1px; всё, что не залилось и не
    # фигура, — внутренняя дырка.
    padded = np.pad(opaque, 1)
    # .copy(): картинка поверх numpy-буфера только для чтения, floodfill
    # в неё писать не может (молча ничего не делает).
    outside = Image.fromarray((~padded).astype(np.uint8) * 255, "L").copy()
    ImageDraw.floodfill(outside, (0, 0), 128)
    outside_arr = np.asarray(outside) == 128
    holes = (~padded) & (~outside_arr)
    filled = padded.sum() + holes.sum()
    if filled and holes.sum() / filled > 0.02:
        flags.append("holes")

    # Обычный сглаженный край даёт 1–3 % полупрозрачных пикселей; белая
    # пиала, в которой модель не уверена, — 15–40 %.
    visible = alpha > 16
    semi = (alpha > 16) & (alpha < 240)
    if visible.sum() and semi.sum() / visible.sum() > 0.10:
        flags.append("soft-edges")

    return flags


def sha1_file(p: Path) -> str:
    h = hashlib.sha1()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()
