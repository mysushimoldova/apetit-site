# Подготовка фото блюд — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Из `assets/foto-originale/` получить вырезки блюд без фона в трёх ширинах WebP + мастер-PNG, манифест `src/data/images.json` и контрольный лист для проверки качества.

**Architecture:** Один Python-скрипт `scripts/prepare-images.py` (Pillow + rembg + numpy). PNG с реальной прозрачностью — только обрезка полей; JPG/PNG без прозрачности — rembg (модель isnet-general-use, alpha matting) на уменьшенной копии (длинная сторона 2048), маска поднимается до исходного размера и накладывается на оригинал → мастер-PNG в исходном размере → WebP 400/800/1600 (без апскейла). Идемпотентность — по sha1 исходника в манифесте. Эвристики «плохой вырезки» → флаги в манифесте и в отчёте. Контрольный лист — из `-400.webp` по 6 в ряд на #FAF7F2.

**Tech Stack:** Python 3.14 · Pillow 12 · rembg 2.0.84 + onnxruntime 1.30 · numpy · unittest (Python) · Vitest (манифест + идемпотентность).

**Spec:** промпт архитектора от 19.09.2026 («подготовка фото блюд»), DESIGN.md 2.1 → Imagery, Food Image; CLAUDE.md (фото — `assets/foto-originale/`, имя файла = slug).

## Global Constraints

- Исходники не трогать; выход только в `public/img/products/` и `src/data/images.json`.
- WebP: ширины 400 / 800 / 1600, quality 82. Мастер `<slug>.png` в исходном размере — в `.gitignore` (только `public/img/products/*.png`).
- Пропустить: `desktop.ini`, `le-coq-margarita-mojito.png` (в папке его нет; есть `le-coq-margarita.png` и `le-coq-mojito.png` — оба в меню, обрабатываем, расхождение — в отчёт).
- Контрольный лист: `docs/screens/02-produse-sheet.png`, фон `#FAF7F2`, 6 в ряд, подписи slug.
- Никаких платных сервисов; всё локально на CPU.

## Review Focus

1. Повторный запуск без изменений ничего не перезаписывает и не меняет манифест (байт в байт). — Vitest `images.test.ts` (идемпотентность).
2. Исходник шире 1600 обязан дать все три размера; узкий — только те, что не требуют апскейла. — unittest `size_ladder`.
3. PNG с альфа-каналом, но целиком непрозрачный (alpha везде 255) — должен идти через rembg, а не «только обрезка». — unittest `has_real_alpha`.
4. rembg «съел» светлый лаваш: дырки внутри маски и низкое покрытие → флаг в манифесте и в списке отчёта, а не молчание. — unittest `quality_flags`.
5. Файл с чужим расширением / битый файл в папке → пропуск с сообщением, скрипт не падает. — unittest `iter_sources`.

## «Допрос плана» (решения)

| Вопрос | Решение |
|---|---|
| Матирование на 12 Мп слишком медленное (минуты на файл). | Маска считается на копии 2048px по длинной стороне (сама модель всё равно работает на 1024px), затем LANCZOS-апскейл альфы на оригинал. Мастер остаётся в исходном размере. |
| Какая модель rembg? | `isnet-general-use` — заметно точнее u2net на предметке, ~170 МБ, качается сама. |
| Le Coq: один файл или два? | Два файла, оба — позиции меню. Обрабатываем оба, пишем в отчёт. |
| Как тестировать Python-код без pytest? | Встроенный `unittest` (ничего ставить не надо): `py -3 -m unittest scripts/test_prepare_images.py`. Манифест и идемпотентность — из Vitest, чтобы попадать в `npm test`. |
| Шрифт подписей на листе? | Системный Segoe UI / Arial — это QA-документ, не интерфейс. |

---

### Task 1: Чистые функции + unittest

**Files:**
- Create: `scripts/prepare_images_lib.py` (чистые функции, без rembg)
- Test: `scripts/test_prepare_images.py`

**Interfaces (Produces):**
```python
SKIP_FILES = {"desktop.ini", "le-coq-margarita-mojito.png"}
WIDTHS = (400, 800, 1600); QUALITY = 82; WORK_LONG_SIDE = 2048
def slug_from_path(p: Path) -> str
def iter_sources(src_dir: Path) -> list[Path]            # png/jpg/jpeg, без SKIP_FILES, отсортировано
def has_real_alpha(im: Image.Image) -> bool               # есть ли пиксели с alpha < 250
def trim_alpha(im: Image.Image, threshold=8) -> Image.Image  # crop по bbox alpha>threshold
def size_ladder(width: int) -> list[int]                  # [w for w in WIDTHS if w <= width]
def quality_flags(alpha: np.ndarray) -> list[str]         # "low-coverage" | "holes" | "soft-edges"
def sha1_file(p: Path) -> str
```

- [ ] **Step 1: Падающие тесты** (`scripts/test_prepare_images.py`, unittest, синтетические картинки 64×64)
- [ ] **Step 2:** `py -3 -m unittest scripts/test_prepare_images.py` → ImportError.
- [ ] **Step 3:** Реализация `prepare_images_lib.py`.
- [ ] **Step 4:** Тесты зелёные.

---

### Task 2: Скрипт обработки + манифест + контрольный лист

**Files:**
- Create: `scripts/prepare-images.py`
- Modify: `.gitignore` (+ `public/img/products/*.png`)
- Modify: `package.json` (скрипт `"images": "py -3 scripts/prepare-images.py"`)
- Output: `public/img/products/*.webp`, `src/data/images.json`, `docs/screens/02-produse-sheet.png`

**Поведение:**
- `--force` — пересчитать всё; `--only SLUG [SLUG…]` — только эти; `--sheet-only` — только лист из готовых файлов.
- Для каждого источника: если в манифесте есть запись с тем же `sourceHash` и все файлы на месте → skip. Иначе: PNG с альфой → `trim_alpha`; иначе → rembg на копии 2048 → альфа → апскейл → на оригинал → `trim_alpha` → мастер PNG → WebP по `size_ladder`. Флаги качества только для rembg.
- Манифест: `{"generatedBy": "...", "pipeline": 1, "products": {slug: {source, sourceHash, method, width, height, sizes, flags}}}`, ключи отсортированы, `indent=2`, `ensure_ascii=False`, в конце `\n`.
- Сводка в stdout: обработано / пропущено / с флагами (список).

- [ ] **Step 1:** Написать скрипт.
- [ ] **Step 2:** Первый прогон (фон, ~15 мин): `py -3 scripts/prepare-images.py`. Проверить: 50 записей, файлы на месте.
- [ ] **Step 3:** Открыть `docs/screens/02-produse-sheet.png` и оценить глазами каждую вырезку; сравнить со списком флагов.

---

### Task 3: Vitest — манифест валиден, скрипт идемпотентен

**Files:**
- Test: `src/data/images.test.ts`

- [ ] **Step 1:** Тест: JSON читается; у каждого slug width/height > 0, `sizes` непустой и ⊆ {400,800,1600}, для каждого размера файл `public/img/products/<slug>-<w>.webp` существует и не пустой; ключи отсортированы; нет `desktop`, нет `le-coq-margarita-mojito`; `method ∈ {alpha, rembg}`.
- [ ] **Step 2:** Тест идемпотентности: снять sha1 всех файлов в `public/img/products` + манифеста → `spawnSync("py", ["-3", "scripts/prepare-images.py"])` → снять ещё раз → deepEqual; в stdout `processed 0`. Если `py` не найден — `test.skip` с сообщением.
- [ ] **Step 3:** `npm test` зелёный.

---

### Task 4: Проверка, отчёт, коммит

- [ ] `npm run lint` · `npm run build` · `npm test` · `npm run test:e2e` · `py -3 -m unittest scripts/test_prepare_images.py`.
- [ ] PROGRESS.md: что сделано, список плохих вырезок (эвристики + глазами), вопросы.
- [ ] `git add -A && git commit -m "feat: product image pipeline"` · `git push`.
