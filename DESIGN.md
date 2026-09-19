# Apetit — DESIGN.md
> Тёплый кремовый стол, на котором лежит еда. Один жёлтый акцент — цена и кнопка «в корзину». Стекло только там, где интерфейс парит над едой: шапка, корзина, экран городов.

**Тема:** светлая · **Основа:** Apple (продукт — герой, сдержанность) + ElevenLabs (тёплая бумага вместо белого) + бренд Apetit (PSD меню)
**Главный экран:** телефон 390 px. Десктоп — та же система, шире.

Apetit — фастфуд, и еда должна выглядеть так, чтобы хотелось есть. Поэтому фото
блюд — единственный «декор». Всё остальное отступает: тёплый кремовый фон вместо
белого, тонкие линии вместо рамок, мягкие тени вместо резких, одна жёлтая
краска для денег и действий. Заголовки — узкий плотный Oswald заглавными, как в
печатном меню; названия и цены — Manrope Bold; текст — Montserrat. Никаких
украшений ради украшений: если элемент не помогает выбрать блюдо — его нет.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Cream | `#F6F1E9` | `--color-cream` | Фон страницы. Тёплый крем, не белый — глаз отдыхает, еда выглядит теплее |
| Milk | `#FCFAF6` | `--color-milk` | Поверхность карточек, панелей, инпутов. Светлее фона — карточка «лежит» на столе |
| Sand | `#EAE2D5` | `--color-sand` | Тонкие линии, разделители, рамки инпутов, фон выключенных элементов |
| Yellow | `#FFBC0D` | `--color-yellow` | ЕДИНСТВЕННЫЙ цветной акцент: цена, кнопка «+», кнопка «Заказать», активный переключатель размера. Только заливка, никогда текст |
| Yellow Deep | `#E9A800` | `--color-yellow-deep` | Нажатое состояние жёлтого |
| Ink | `#1A1714` | `--color-ink` | Основной текст, чёрные кнопки, активная категория. Тёплый чёрный из меню |
| Charcoal | `#3D3733` | `--color-charcoal` | Второстепенный текст, состав блюда |
| Smoke | `#7A716A` | `--color-smoke` | Граммы, подписи, плейсхолдеры |
| Ash | `#A79E95` | `--color-ash` | Самый тихий текст: подвал, мелкий шрифт |
| Open | `#2F8F5B` | `--color-open` | Только точка-индикатор «открыто сейчас» |
| Closed | `#C9473A` | `--color-closed` | Только «закрыто» и ошибки формы. Никогда для акций или кнопок |
| Peach Glow | `#FFD9A8` | `--color-peach-glow` | Второе размытое пятно на фоне (с жёлтым). Декор, только blur ≥ 120px, opacity ≤ 0.35 |

Правило: жёлтый — это поверхность, а не цвет текста. Текст на жёлтом — всегда Ink.
Жёлтый на кремовом фоне как текст не читается — так не делаем никогда.

## Tokens — Typography

### Oswald — заголовки категорий, названия городов, номер заказа. Всегда ЗАГЛАВНЫМИ · `--font-display`
- **Weights:** 600
- **Sizes:** 44px (города на входе), 28px (категории), 22px (заголовок листа блюда)
- **Line height:** 1.0–1.05
- **Letter spacing:** +0.02em (Oswald узкий, лёгкий разлёт даёт воздух)
- **Роль:** только крупные надписи. Никогда для текста и кнопок.

### Manrope — названия блюд, цены, кнопки, чипы категорий · `--font-ui`
- **Weights:** 600, 700, 800
- **Sizes:** 15px (чип, кнопка), 17px (название), 18px (цена), 20px (итого)
- **Line height:** 1.25
- **Letter spacing:** −0.01em
- **Роль:** всё, что нажимают или сравнивают. 800 — только цена и итого.

### Montserrat — состав, описания, формы, подвал · `--font-body`
- **Weights:** 400, 500
- **Sizes:** 12px (подпись), 13px (граммы, состав), 15px (текст, инпуты)
- **Line height:** 1.5
- **Роль:** всё остальное. 500 — подписи полей и мелкие акценты.

### Type Scale

| Role | Size | Line Height | Font / Weight | Token |
|------|------|-------------|---------------|-------|
| caption | 12px | 1.4 | Montserrat 500 | `--text-caption` |
| meta | 13px | 1.5 | Montserrat 400 | `--text-meta` |
| body | 15px | 1.5 | Montserrat 400 | `--text-body` |
| label | 15px | 1.25 | Manrope 600 | `--text-label` |
| title | 17px | 1.25 | Manrope 700 | `--text-title` |
| price | 18px | 1.2 | Manrope 800 | `--text-price` |
| total | 20px | 1.2 | Manrope 800 | `--text-total` |
| sheet-title | 22px | 1.05 | Oswald 600 caps | `--text-sheet-title` |
| category | 28px | 1.05 | Oswald 600 caps | `--text-category` |
| city | 44px | 1.0 | Oswald 600 caps | `--text-city` |

Шрифты лежат в проекте (`/public/fonts`, woff2, latin + latin-ext для румынских ș ț ă â î и cyrillic). Не грузить с Google CDN.

## Tokens — Spacing & Shapes

**Base unit:** 4px · **Density:** comfortable · **Боковой отступ на телефоне:** 16px · **Максимальная ширина контента:** 1200px

### Spacing Scale
4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 96

### Border Radius

| Element | Value |
|---------|-------|
| buttons, chips, price pill | 9999px |
| product card | 20px |
| city tile | 24px |
| bottom sheet (верх) | 28px |
| inputs | 14px |
| images inside cards | 16px |
| small (badge) | 8px |

### Shadows

| Name | Value | Where |
|------|-------|-------|
| card | `0 1px 2px rgba(26,23,20,.04), 0 8px 24px rgba(26,23,20,.06)` | карточки блюд, панели |
| lift | `0 12px 32px rgba(26,23,20,.10)` | нажатая/поднятая карточка, открытый лист |
| glass | `0 8px 24px rgba(26,23,20,.06)` | стеклянные панели |
| food puddle | см. «Food Image» ниже | тень под фото блюда |

Тени всегда тёплые (на основе Ink), никогда чисто чёрные, никогда резкие.

### Glass (ровно три места: шапка, нижняя панель корзины, оверлей выбора города)

```
background: rgba(252, 250, 246, 0.72);
backdrop-filter: blur(18px) saturate(140%);
-webkit-backdrop-filter: blur(18px) saturate(140%);
border: 1px solid rgba(255, 255, 255, 0.6);
box-shadow: var(--shadow-glass);
```
Fallback без backdrop-filter: `background: rgba(252,250,246,0.96)`.
Нигде больше стекло не используем: на дешёвых Android каждый blur стоит кадров.

### Background Glow (фон страницы)

Два неподвижных размытых пятна на Cream: жёлтое (Yellow, opacity .22) справа
сверху и персиковое (Peach Glow, opacity .30) слева на уровне первой категории.
`filter: blur(120px)`, `pointer-events: none`, рендерятся один раз, не
анимируются, не следуют за скроллом. На экране городов — те же пятна, чуть ярче
(.30 / .38). Это и есть «глубина»: свет, а не градиент.

## Components

### City Tile — экран входа
Milk fill, 24px radius, shadow card, высота 96px на телефоне, название города
Oswald 44px caps Ink по центру. Больше ничего внутри: ни иконок, ни телефонов.
Шесть плиток столбиком с зазором 12px, экран без шапки и подвала. Нажатие:
плитка чуть приподнимается (scale 1.02, shadow lift), затем раскрывается в меню.

### Header — стекло
Высота 56px, sticky, glass. Слева логотип APETIT (SVG из assets/logo, высота 22px,
Ink). По центру ничего. Справа: название города Manrope 600 15px с маленькой
стрелкой вниз (нажатие = сменить город) и переключатель RO/RU 13px Smoke.

### Category Chips — лента категорий
Горизонтальный скролл под шапкой, sticky вместе с ней. Чип: Manrope 600 15px,
высота 40px, 9999px, padding 0 16px. Неактивный — Milk fill, Sand border.
Активный — Ink fill, Milk text. Не жёлтый: жёлтый занят деньгами.

### Product Card
Milk fill, 20px radius, shadow card, padding 12px. Сверху фото блюда (см. Food
Image), под ним название Manrope 700 17px Ink (максимум 2 строки), граммы
Montserrat 13px Smoke, внизу ряд: цена в Price Pill слева, кнопка Add справа.
Сетка на телефоне: 2 колонки, зазор 12px. На десктопе: 4 колонки.

### Food Image
Вырезка блюда без фона (PNG/WebP) на Milk, высота 140px в карточке, 260px в
листе блюда. Под фото — «лужица» тени: псевдоэлемент-эллипс шириной 70% фото,
высотой 14px, `radial-gradient(ellipse, rgba(26,23,20,.22), transparent 70%)`.
Это дешёвая замена drop-shadow из PSD — выглядит так же, стоит ноль кадров.
Нет фото → Sand плитка 16px radius с силуэтом тарелки Ash, никакого «No image».

### Price Pill
Yellow fill, Ink text, Manrope 800 18px, высота 32px, 9999px, padding 0 12px.
Формат: `85 lei`, при размерах — `de la 80 lei`. Самый заметный элемент карточки после фото.

### Add Button
Круг 36px, Yellow fill, Ink «+» 2px stroke. Нажатие: scale .92 → 1, значок
корзины в нижней панели один раз подпрыгивает. После добавления круг становится
Ink с белой цифрой количества и ±.

### Product Sheet — открытая карточка
Bottom sheet снизу, Milk, 28px радиус сверху, shadow lift, ручка-полоска Sand
вверху. Фото 260px, название Oswald 22px caps, состав Montserrat 13px Charcoal,
граммы Smoke. Блоки: Размер (сегменты 9999px, активный Yellow), Убрать
(галочки, бесплатно, Montserrat 15px), Добавить (строки с ценой справа
Manrope 600). Внизу прилипшая панель: количество ± слева, кнопка Primary
«В корзину · 198 lei» справа.

### Primary Button
Yellow fill, Ink text Manrope 700 15px, высота 52px, 9999px, полная ширина на
телефоне. Единственная жёлтая кнопка на экране. Нажатие: Yellow Deep.
Disabled (закрыто / пустая корзина): Sand fill, Smoke text, без тени.

### Secondary Button
Milk fill, Sand border 1px, Ink text Manrope 600 15px, высота 48px, 9999px.
«Сменить город», «Открыть в Google Maps», «Все отзывы».

### Cart Bar — стекло
Fixed снизу, glass, высота 72px, padding 12px 16px, появляется снизу когда в
корзине ≥ 1. Слева иконка корзины Ink с бейджем количества (Ink круг, Milk
цифра), по центру «3 poziții», справа Primary «Coș · 250 lei».

### Point Card — выбор точки в Сороках
Milk, 20px, shadow card, padding 16px. Название Manrope 700 17px, адрес
Montserrat 13px Charcoal, часы + точка-индикатор Open/Closed 13px, расстояние
«1,2 km · 15 min» Manrope 600 15px справа. Выбранная: border 2px Yellow.

### Input
Milk fill, Sand border 1px, 14px radius, высота 52px, Montserrat 15px Ink,
label 13px Smoke над полем. Focus: border Ink. Ошибка: border Closed, подпись
Closed 12px под полем. Никаких плавающих лейблов.

### Order Confirmation
Cream фон, центр: круг 96px Yellow с галочкой Ink, номер заказа Oswald 44px
caps, текст Montserrat 15px Charcoal, ниже карточка Milk с составом и итого,
Secondary «Sună la local».

### Promo Card
Milk, 20px, фото на всю ширину карточки 16px radius, заголовок Manrope 700 17px,
текст 13px. Горизонтальная лента, одна карточка — 84% ширины экрана.
Блок отсутствует, когда акций нет.

### Closed Banner
Sand fill, 14px radius, Montserrat 15px Ink, точка Closed: «Acum e închis.
Deschidem la 08:30». Primary кнопка внизу disabled.

## Motion

| Token | Value |
|-------|-------|
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| `--dur-fast` | 150ms — нажатия, переключатели |
| `--dur-base` | 240ms — появление карточек, чипы, лист |
| `--dur-slow` | 420ms — экран городов, переход в меню |

- Вход: плитки городов появляются снизу (y 24 → 0, opacity 0 → 1) с задержкой
  60ms друг за другом. Выбранная плитка увеличивается и растворяется в шапку меню.
- Карточки блюд: появляются при скролле один раз (y 12 → 0, opacity), группами
  по строке, задержка 40ms. Больше не анимируются.
- Фото блюд: лёгкий параллакс при скролле, ±6px, только `transform`, только
  на десктопе. На телефоне выключен.
- Лист блюда: выезжает снизу 240ms, фон затемняется до rgba(26,23,20,.35).
- Всё через `transform` и `opacity`. Ничего через `top/left/height/filter`.
- `prefers-reduced-motion: reduce` → все длительности 0, параллакс выключен.
- Ничего не крутится бесконечно, ничего не всплывает само, нет автокаруселей.

## Do's and Don'ts

### Do
- Фон — Cream, карточки — Milk, линии — Sand. Никогда чистый белый `#FFFFFF`
  и никогда чистый серый.
- Жёлтый только как заливка: цена, «+», Primary, активный размер. Одна краска — одна работа.
- Заголовки категорий — Oswald 600 ЗАГЛАВНЫМИ, как в печатном меню. Это
  узнаваемость бренда.
- Фото блюда — самый крупный элемент любой карточки. Текст меньше фото всегда.
- Тени тёплые и мягкие; под едой — «лужица», а не box-shadow.
- Все кнопки и чипы — 9999px. Карточки — 20px. Других радиусов нет.
- Стекло — ровно три места. Проверять на дешёвом Android, что скролл 60 fps.
- Экран городов — только шесть плиток. Ни логотипа, ни текста, ни крестика.

### Don't
- Не использовать жёлтый как цвет текста, рамки или градиента.
- Не добавлять второй акцентный цвет. Зелёный и красный — только индикаторы состояния.
- Не ставить Oswald на текст, кнопки или цены — только крупные заголовки.
- Не делать чёрных секций, тёмных подвалов, «hero» с фото во весь экран — сайт светлый насквозь.
- Не использовать эмодзи, иконки в цветных кружочках, стоковые иллюстрации,
  «три карточки с преимуществами», фиолетовые/синие градиенты, glow-обводки.
- Не показывать «Lorem ipsum», «Image coming soon», плейсхолдерные тексты.
- Не анимировать `box-shadow`, `filter`, `height`. Не делать бесконечных анимаций.
- Не ставить всплывающие окна, cookie-плашки, баннеры «скачай приложение», чат-виджеты.
- Не сжимать боковой отступ меньше 16px на телефоне.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Cream | `#F6F1E9` | Фон страницы + два размытых пятна |
| 1 | Milk | `#FCFAF6` | Карточки, панели, инпуты, лист |
| 2 | Glass | `rgba(252,250,246,.72)` + blur 18px | Шапка, корзина, оверлей города |
| 3 | Ink | `#1A1714` | Активный чип, бейдж количества, «Принят» |

## Imagery

Только реальные фото блюд Apetit: вырезки без фона из `assets/foto-originale`
(WebP, 3 размера: 400 / 800 / 1600). Фото всегда на Milk, никогда на Cream
напрямую. Атмосферные фото (интерьер, команда) — только в блоке Instagram внизу,
16px radius, без текста поверх. Иконки — Lucide, stroke 1.75px, цвет Ink или
Smoke, размер 20–24px, без заливки и без кружков вокруг. Логотип — SVG из
`assets/logo`, Ink на светлом; никаких перекрасок в жёлтый.

## Layout

Телефон: одна колонка, 16px по бокам, сетка блюд 2 × N, зазор 12px. Шапка 56px
+ лента категорий 52px прилипают вместе. Cart Bar 72px снизу, контент имеет
padding-bottom 88px, когда корзина не пуста. Десктоп (≥1024px): контент 1200px
по центру, сетка 4 колонки, лист блюда становится центрированным модальным
окном 520px с теми же радиусами, Cart Bar превращается в кнопку в шапке.
Страница меню — единственный длинный скролл; категории — якоря.

## Agent Prompt Guide

**Quick Reference**
- background: #F6F1E9 · surface: #FCFAF6 · line: #EAE2D5
- text: #1A1714 (primary) · #3D3733 (secondary) · #7A716A (meta) · #A79E95 (faint)
- action & price: #FFBC0D fill, #1A1714 text · pressed #E9A800
- status: #2F8F5B open · #C9473A closed/error
- fonts: Oswald 600 caps (display) · Manrope 600–800 (UI) · Montserrat 400/500 (body)
- radii: 9999px pills · 20px cards · 24px city tiles · 28px sheet · 14px inputs
- glass: header, cart bar, city overlay only

**Example Component Prompts**
1. Product card: Milk `#FCFAF6` surface, 20px radius, shadow `0 1px 2px rgba(26,23,20,.04), 0 8px 24px rgba(26,23,20,.06)`, padding 12px. Food cutout 140px tall with a radial-gradient puddle shadow beneath. Title Manrope 700 17px `#1A1714`, 2 lines max. Meta "290 g" Montserrat 13px `#7A716A`. Bottom row: price pill (Yellow fill, Ink text, Manrope 800 18px, 32px tall, 9999px) left, 36px yellow circle "+" right.
2. City tile: Milk surface, 24px radius, 96px tall, card shadow, city name Oswald 600 44px uppercase `#1A1714` centered, letter-spacing .02em. Six tiles stacked with 12px gap on a Cream canvas with two static blurred glows (Yellow .30, Peach .38, blur 120px). No header, no footer, no other text.
3. Cart bar: fixed bottom, 72px, glass (`rgba(252,250,246,.72)`, blur 18px, 1px rgba(255,255,255,.6) border). Left: cart icon Lucide 24px Ink with Ink badge. Center: "3 poziții" Montserrat 15px. Right: Primary pill Yellow fill "Coș · 250 lei" Manrope 700 15px, 52px tall.
4. Category chips: horizontal scroll, sticky under header. Inactive: Milk fill, 1px Sand border, Manrope 600 15px Ink, 40px tall, 9999px. Active: Ink fill, Milk text. Scroll-snap, 8px gap, 16px side padding.
5. Product sheet: bottom sheet, Milk, 28px top radius, lift shadow, 36×4px Sand handle. Food image 260px with puddle shadow. Title Oswald 600 22px uppercase. Ingredients Montserrat 13px `#3D3733`. Size segmented control (pills, active Yellow). Sticky footer: quantity stepper left, Primary "Adaugă · 198 lei" right.
