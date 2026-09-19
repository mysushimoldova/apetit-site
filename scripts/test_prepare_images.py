"""Тесты чистых функций пайплайна фото. Запуск:
    py -3 -m unittest scripts/test_prepare_images.py
Без rembg: только синтетические картинки 64×64.
"""

import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prepare_images_lib import (  # noqa: E402
    SKIP_FILES,
    has_real_alpha,
    iter_sources,
    quality_flags,
    size_ladder,
    slug_from_path,
    trim_alpha,
)


def rgba(w=64, h=64, alpha=0):
    im = Image.new("RGBA", (w, h), (200, 100, 50, 255))
    a = Image.new("L", (w, h), alpha)
    im.putalpha(a)
    return im


class SlugAndSources(unittest.TestCase):
    def test_slug_is_stem(self):
        self.assertEqual(slug_from_path(Path("x/kebab-cheese.jpg")), "kebab-cheese")
        self.assertEqual(slug_from_path(Path("Pizza-Margarita.PNG")), "pizza-margarita")

    def test_iter_sources_skips_junk_and_sorts(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            for name in ["b.jpg", "a.png", "desktop.ini", "le-coq-margarita-mojito.png", "notes.txt", "c.jpeg"]:
                (root / name).write_bytes(b"x")
            self.assertEqual([p.name for p in iter_sources(root)], ["a.png", "b.jpg", "c.jpeg"])

    def test_skip_list_contains_architect_files(self):
        self.assertIn("desktop.ini", SKIP_FILES)
        self.assertIn("le-coq-margarita-mojito.png", SKIP_FILES)


class Alpha(unittest.TestCase):
    def test_has_real_alpha_true_when_transparent_pixels(self):
        im = rgba(alpha=255)
        im.putpixel((3, 3), (0, 0, 0, 0))
        self.assertTrue(has_real_alpha(im))

    def test_has_real_alpha_false_for_opaque_rgba_and_rgb(self):
        self.assertFalse(has_real_alpha(rgba(alpha=255)))
        self.assertFalse(has_real_alpha(Image.new("RGB", (8, 8), (255, 255, 255))))

    def test_trim_alpha_crops_to_visible_bbox(self):
        im = rgba(alpha=0)
        for x in range(10, 30):
            for y in range(20, 25):
                im.putpixel((x, y), (255, 0, 0, 255))
        out = trim_alpha(im)
        self.assertEqual(out.size, (20, 5))
        self.assertEqual(out.getpixel((0, 0))[3], 255)

    def test_trim_alpha_ignores_faint_noise(self):
        im = rgba(alpha=0)
        im.putpixel((0, 0), (255, 0, 0, 3))  # шум матирования
        im.putpixel((40, 40), (255, 0, 0, 255))
        self.assertEqual(trim_alpha(im, threshold=8).size, (1, 1))


class Sizes(unittest.TestCase):
    def test_size_ladder_never_upscales(self):
        self.assertEqual(size_ladder(2000), [400, 800, 1600])
        self.assertEqual(size_ladder(1600), [400, 800, 1600])
        self.assertEqual(size_ladder(1000), [400, 800])
        self.assertEqual(size_ladder(500), [400])
        self.assertEqual(size_ladder(300), [])


class Quality(unittest.TestCase):
    def solid(self):
        a = np.zeros((100, 100), dtype=np.uint8)
        a[10:90, 10:90] = 255
        return a

    def test_solid_shape_has_no_flags(self):
        self.assertEqual(quality_flags(self.solid()), [])

    def test_hole_inside_mask_is_flagged(self):
        a = self.solid()
        a[40:60, 40:60] = 0  # rembg «съел» кусок лаваша
        self.assertIn("holes", quality_flags(a))

    def test_tiny_blob_is_low_coverage(self):
        a = np.zeros((100, 100), dtype=np.uint8)
        a[0:100:10, 0:100:10] = 255  # редкая крошка по всему bbox
        self.assertIn("low-coverage", quality_flags(a))

    def test_mostly_semi_transparent_is_soft_edges(self):
        a = self.solid()
        a[10:90, 10:90] = 120
        self.assertIn("soft-edges", quality_flags(a))

    def test_semi_transparent_bowl_rim_is_soft_edges(self):
        # sos-mustar-miere: белая пиала на 17% полупрозрачная — это дефект
        a = self.solid()
        a[10:90, 10:24] = 120  # ~17% площади фигуры
        self.assertIn("soft-edges", quality_flags(a))

    def test_thin_antialiased_edge_is_fine(self):
        a = self.solid()
        a[10:90, 10:12] = 120  # обычный сглаженный край ~2.5%
        self.assertNotIn("soft-edges", quality_flags(a))


if __name__ == "__main__":
    unittest.main()
