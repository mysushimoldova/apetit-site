"""Фон «линии с телевизоров Apetit» (DESIGN.md → Background).

Исходник — видео assets/brand/linii-fundal.mp4 (не в git): тёмные контурные
линии на белом. Скрипт в два шага:

    py -3 scripts/bg-lines.py frames                 # 8 кадров → docs/bg-frames/
    py -3 scripts/bg-lines.py build docs/bg-frames/kadr-08s.png [--line 1.0]

frames — кадры с 1, 4, 8, … 28-й секунды (PNG в полном размере), чтобы
выбрать тот, где линии чище. build — из выбранного кадра делает картинку
«только линии»: цвет Ash #A79E95, фон прозрачный, WebP с альфой (без
потерь, 8 уровней прозрачности), ширина 1600px, вес ≤150 КБ →
public/img/bg/linii.webp.

--line — толщина линий в px экрана телефона 390×844 (там картинка стоит
cover по высоте). По умолчанию 1.0 (вариант A1), 0.6 — «волосок» (A2).
Линии не «растворяются» прозрачностью, а рисуются заново: у каждой линии
кадра находится осевая линия, и вокруг неё рисуется линия нужной толщины
со сглаживанием; яркость линии берётся из кадра.

Нужен ffmpeg (для frames): в PATH или путь в переменной FFMPEG.
Нужны numpy, pillow, scipy, scikit-image — ставятся вместе с
scripts/requirements.txt (scipy и scikit-image приходят с rembg).
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
from scipy import ndimage
from skimage.morphology import skeletonize

ROOT = Path(__file__).resolve().parent.parent
VIDEO = ROOT / "assets" / "brand" / "linii-fundal.mp4"
FRAMES_DIR = ROOT / "docs" / "bg-frames"
OUT = ROOT / "public" / "img" / "bg" / "linii.webp"

FRAME_SECONDS = (1, 4, 8, 12, 16, 20, 24, 28)
ASH = (0xA7, 0x9E, 0x95)  # цвет линий (DESIGN.md → Colors, Ash)
WIDTH = 1600
MAX_BYTES = 150 * 1024
# Альфа ниже этого порога — шум сжатия видео, а не линия: обнуляем
NOISE_FLOOR = 0.06
# Пиксель кадра считается линией, если альфа выше: по этой маске ищется
# осевая линия (на кадре 8 с — 65 линий, мелкого мусора нет)
LINE_MASK = 0.35
# Уровней прозрачности: 8 на глаз не отличить от 256 (линии тонкие, Ash,
# на фоне с opacity), а WebP без потерь выходит почти вдвое легче —
# картинка грузится вместе с первым экраном и влияет на Lighthouse
ALPHA_LEVELS = 8
# Экран, по которому считается --line: телефон 390×844, картинка cover —
# по высоте экрана (lvh), поэтому 1 px экрана = высота картинки / 844 px её
PHONE_HEIGHT = 844
DEFAULT_LINE = 1.0  # A1


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


def redraw_lines(alpha: np.ndarray, width_px: float) -> np.ndarray:
    """Линии кадра → те же линии толщиной width_px (в пикселях кадра).

    Осевая линия — скелет маски линий; каждый пиксель получает покрытие
    по расстоянию до оси (край сглажен на 1 px) и яркость ближайшей точки
    оси. Края кадра дополняются зеркально — как соседний повтор слоя
    (картинка, зеркальная копия, картинка): стыков нет.
    """
    pad = int(np.ceil(width_px)) + 4
    a = np.pad(alpha, pad, mode="symmetric")
    axis = skeletonize(a > LINE_MASK)
    # Яркость линии — максимум альфы кадра рядом с осью
    peak = ndimage.maximum_filter(a, size=3)
    dist, (iy, ix) = ndimage.distance_transform_edt(~axis, return_indices=True)
    cover = np.clip(width_px / 2 + 0.5 - dist, 0.0, 1.0)
    out = cover * peak[iy, ix]
    return out[pad:-pad, pad:-pad]


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


def build(frame: Path, line: float) -> None:
    src = np.asarray(Image.open(frame).convert("L"))
    scale = src.shape[1] / WIDTH  # пикселей кадра в пикселе картинки
    height = round(src.shape[0] / scale)
    # Толщина: px экрана телефона → px картинки → px кадра
    width_px = line * height / PHONE_HEIGHT * scale
    # Линии рисуются в полном размере кадра, потом уменьшаются усреднением
    # (BOX): толщина и сглаживание сохраняются, без ореолов
    big = redraw_lines(lines_alpha(src), width_px)
    small = Image.fromarray(np.round(big * 255).astype(np.uint8), "L").resize(
        (WIDTH, height), Image.Resampling.BOX
    )
    alpha = np.asarray(small, dtype=np.float32) / 255
    alpha[alpha < NOISE_FLOOR] = 0.0
    data = encode(alpha)
    if len(data) > MAX_BYTES:
        sys.exit(
            f"{len(data) // 1024} КБ — больше {MAX_BYTES // 1024} КБ: "
            "уменьшите ALPHA_LEVELS или возьмите кадр с меньшим числом линий"
        )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(data)
    print(
        f"{OUT.relative_to(ROOT)}: {WIDTH}×{height}, линии {line} px на "
        f"телефоне ({width_px / scale:.2f} px картинки), {len(data) // 1024} КБ"
    )


def positive(value: str) -> float:
    number = float(value)
    if not 0 < number <= 4:
        raise argparse.ArgumentTypeError("толщина — от 0 до 4 px")
    return number


def main() -> None:
    # Консоль Windows по умолчанию cp1252 — кириллица в сообщениях падала бы
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("frames", help="вытащить кадры из видео в docs/bg-frames/")
    b = sub.add_parser("build", help="сделать public/img/bg/linii.webp из кадра")
    b.add_argument("frame", type=Path)
    b.add_argument(
        "--line", type=positive, default=DEFAULT_LINE,
        help="толщина линий в px экрана телефона 390×844 "
        f"(по умолчанию {DEFAULT_LINE} — A1; 0.6 — A2)",
    )
    args = parser.parse_args()
    if args.cmd == "frames":
        extract_frames()
    else:
        build(args.frame, args.line)


if __name__ == "__main__":
    main()
