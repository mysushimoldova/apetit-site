"""Фон «линии с телевизоров Apetit» (DESIGN.md → Background).

Исходник — видео assets/brand/linii-fundal.mp4 (не в git, 4K): серые
контурные линии на белом. Скрипт в два шага:

    py -3 scripts/bg-lines.py frames                 # 8 кадров → docs/bg-frames/
    py -3 scripts/bg-lines.py build docs/bg-frames/kadr-08s.png

frames — кадры с 1, 4, 8, … 28-й секунды в полном разрешении видео (PNG,
без масштабирования), чтобы выбрать тот, где линии чище.

build — из выбранного кадра делает плитку «только линии»: кадр целиком
уменьшается до FRAME_WIDTH (усреднением — линии тонкие и чёткие, без
ореолов), и из него и трёх его зеркальных копий собирается плитка 2×2:

    кадр              | зеркало по горизонтали
    зеркало по вертик. | зеркало по обеим осям

У такой плитки правый край совпадает с левым, нижний — с верхним, поэтому
в CSS она повторяется в обе стороны без стыков. Цвет Ash #A79E95, фон
прозрачный, WebP без потерь, 16 уровней прозрачности, вес ≤250 КБ →
public/img/bg/linii.webp. Линии не утончаются: тонкими их делает масштаб
(на экране кадр показывается мельче — см. --bg-frame-w в globals.css).

Нужен ffmpeg (для frames): в PATH или путь в переменной FFMPEG.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
VIDEO = ROOT / "assets" / "brand" / "linii-fundal.mp4"
FRAMES_DIR = ROOT / "docs" / "bg-frames"
OUT = ROOT / "public" / "img" / "bg" / "linii.webp"

FRAME_SECONDS = (1, 4, 8, 12, 16, 20, 24, 28)
ASH = (0xA7, 0x9E, 0x95)  # цвет линий (DESIGN.md → Colors, Ash)
# Ширина одного кадра в плитке; вся плитка — вдвое больше (3200×1800)
FRAME_WIDTH = 1600
MAX_BYTES = 250 * 1024
# Альфа ниже этого порога — шум сжатия видео, а не линия: обнуляем
NOISE_FLOOR = 0.06
# Уровней прозрачности: 16 — сглаженный край линии без ступенек (при 8
# тонкие наклонные линии местами выглядят пунктиром), вес в пределах лимита
ALPHA_LEVELS = 16


def find_ffmpeg() -> str:
    path = os.environ.get("FFMPEG") or shutil.which("ffmpeg")
    if not path:
        sys.exit("ffmpeg не найден: поставьте (winget install Gyan.FFmpeg) или укажите FFMPEG=путь")
    return path


def extract_frames() -> None:
    if not VIDEO.exists():
        sys.exit(f"Нет видео: {VIDEO}")
    ffmpeg = find_ffmpeg()
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)
    for sec in FRAME_SECONDS:
        out = FRAMES_DIR / f"kadr-{sec:02d}s.png"
        # Без -vf scale: кадр в полном разрешении видео
        subprocess.run(
            [ffmpeg, "-v", "error", "-y", "-ss", str(sec), "-i", str(VIDEO),
             "-frames:v", "1", str(out)],
            check=True,
        )
        print(out.relative_to(ROOT))


def lines_alpha(gray: np.ndarray) -> np.ndarray:
    """Яркость кадра (0–255) → непрозрачность линий 0..1.

    Фон — медиана кадра (почти белый), «полная» линия — 0.5-й перцентиль
    (самые тёмные пиксели линий). Между ними — линейно, шум обнуляется.
    """
    g = gray.astype(np.float32)
    paper = float(np.median(g))
    ink = float(np.percentile(g, 0.5))
    if paper - ink < 1:
        return np.zeros_like(g)
    alpha = np.clip((paper - g) / (paper - ink), 0.0, 1.0)
    alpha[alpha < NOISE_FLOOR] = 0.0
    return alpha


def mirror_tile(frame: np.ndarray) -> np.ndarray:
    """Кадр → плитка 2×2 из кадра и его зеркал: повторяется без стыков."""
    return np.block([
        [frame, frame[:, ::-1]],
        [frame[::-1, :], frame[::-1, ::-1]],
    ])


def encode(alpha: np.ndarray) -> bytes:
    """Альфа → WebP без потерь: цвет Ash везде, прозрачность ступенями."""
    h, w = alpha.shape
    steps = ALPHA_LEVELS - 1
    rgba = np.empty((h, w, 4), dtype=np.uint8)
    rgba[..., :3] = ASH  # цвет везде один — сжимается почти в ноль
    rgba[..., 3] = np.round(np.round(alpha * steps) / steps * 255).astype(np.uint8)
    buf = BytesIO()
    Image.fromarray(rgba, "RGBA").save(
        buf, "WEBP", lossless=True, quality=100, method=6
    )
    return buf.getvalue()


def build(frame: Path) -> None:
    src = Image.open(frame).convert("L")
    height = round(src.height * FRAME_WIDTH / src.width)
    # Усреднение (BOX), а не Lanczos: у линий нет светлых ореолов, край чище
    small = np.asarray(src.resize((FRAME_WIDTH, height), Image.Resampling.BOX))
    tile = mirror_tile(lines_alpha(small))
    data = encode(tile)
    if len(data) > MAX_BYTES:
        sys.exit(
            f"{len(data) // 1024} КБ — больше {MAX_BYTES // 1024} КБ: "
            "уменьшите FRAME_WIDTH или возьмите кадр с меньшим числом линий"
        )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(data)
    h, w = tile.shape
    print(f"{OUT.relative_to(ROOT)}: {w}×{h} (кадр {src.width}×{src.height} → "
          f"{FRAME_WIDTH}×{height}, 2×2 зеркально), {len(data) // 1024} КБ")


def main() -> None:
    # Консоль Windows по умолчанию cp1252 — кириллица в сообщениях падала бы
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("frames", help="вытащить кадры из видео в docs/bg-frames/")
    b = sub.add_parser("build", help="сделать public/img/bg/linii.webp из кадра")
    b.add_argument("frame", type=Path)
    args = parser.parse_args()
    if args.cmd == "frames":
        extract_frames()
    else:
        build(args.frame)


if __name__ == "__main__":
    main()
