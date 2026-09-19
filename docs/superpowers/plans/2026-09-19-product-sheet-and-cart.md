# Лист блюда и корзина — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Лист блюда (bottom sheet / модалка 520px) с размером, «Fără», «Extra», количеством и живой ценой; корзина в Zustand с localStorage, привязанная к городу; «+» на плитке со счётчиком; Cart Bar и лист корзины. Без оформления заказа.

**Architecture:** Чистые функции корзины (`src/lib/cart/lines.ts` — позиции и их сложение, `pricing.ts` — цена позиции по id из каталога) не зависят от React и позже переиспользуются сервером (SPEC 9.3). Состояние — vanilla-стор Zustand с `persist` (`skipHydration`, ручной `rehydrate` после монтирования). Страница остаётся серверной: каталог города (блюда с ценами точки, разрешённые добавки, размеры фото) один раз передаётся в клиентский `CartProvider`, который рисует лист блюда, Cart Bar, лист корзины и диалог смены города; плитки получают два маленьких клиентских островка (кнопка-название и счётчик). Лист — нативный `<dialog>` (showModal: фокус внутри, остальная страница inert, Esc) с CSS-переходами; свайп двигает `transform` напрямую.

**Tech Stack:** Next.js 16 · React 19 · Tailwind 4 · zustand 5 (новая, ~1 KB gzip) · zod 4 · lucide-react · Vitest · Playwright.

**Spec:** промпт архитектора 19.09.2026 («лист блюда и корзина»); SPEC §2.2–2.4, §3 шаги 3–4, §9.3; DESIGN.md 2.2 → Product Sheet, Add Button, Price Pill, Primary/Secondary Button, Cart Bar, Motion, Layout.

## Global Constraints

- Цена на клиенте — только для показа. Позиция хранит только id: `productSlug`, `variantId`, `addonIds`, `removedIds`, `qty` — сервер пересчитает всё сам (SPEC 9.3, CLAUDE.md).
- Одинаковые конфигурации складываются (порядок добавок/убранных не важен).
- Корзина хранится в localStorage (`apetit.cart`) вместе с городом; другой город → подтверждение «Ai schimbat orașul — coșul va fi golit» (Continuă / Anulează).
- Убрать ингредиент — бесплатно; добавки — только разрешённые категории блюда, по цене из SPEC 2.4.
- Тексты — только через `messages.ts` (RO + RU, одинаковые ключи). Новые слова от архитектора — временные, список в PROGRESS.md.
- Лист: Milk, радиус 24px сверху, `rule` по верху, `shadow-lift`, ручка 36×4 Sand, фото 280px с лужицей, название Oswald 22px caps, блоки через `hairline`, внизу sticky ± и Primary. Десктоп (≥1024px) — модалка 520px по центру.
- Жёлтый — только заливка: цена, «+», Primary, активный размер. Primary 52px, disabled — Sand/Smoke.
- Cart Bar: fixed снизу, glass, `rule` сверху, 72px, padding 12px 16px; иконка корзины 24px с бейджем Ink/Cream, «N poziții» Montserrat 15px, Primary «Coș · N lei». Десктоп — кнопка в шапке (DESIGN → Layout).
- Анимации: только transform/opacity; лист снизу 240ms `--ease-out`, фон до `rgba(26,23,20,.35)`; reduced-motion → 0. Ничего бесконечного.
- Никаких box-shadow, кроме листа (lift). Радиусы 9999/12/16/24.
- Оформление заказа — НЕ в этой задаче: «Comandă» неактивна.

## Review Focus

1. **Мусор/устаревшее в localStorage** (чужой JSON, блюдо выключили, добавку запретили, qty 0 или 1000) — корзина не падает, битые позиции тихо отбрасываются. → Vitest `parsePersistedCart` + `pruneLines` (Task 1, 2).
2. **Позиция не того города** (корзина Сорок, открыли /briceni по ссылке из Google) — не показываем чужую корзину и не смешиваем: диалог; «Anulează» возвращает в старый город, корзина цела; «Continuă» — пустая корзина нового города. «+» до решения не срабатывает. → Vitest `add` отказывает при чужом городе + e2e диалога (Task 2, 6).
3. **Фокус и клавиатура**: после «+» фокус не теряется (кнопка «+» остаётся тем же элементом); «−» до нуля возвращает фокус на «+»; Esc закрывает лист и фокус возвращается на плитку. → e2e (Task 6).
4. **Тот же блюдо, разные настройки** — «Fără ceapă» и базовый — две позиции; снова базовый — сложение. Счётчик на плитке = все штуки этого блюда. → Vitest (Task 1).
5. **Две вкладки** — добавили в одной, открыта другая: вторая не затирает первую старым состоянием (событие `storage` → rehydrate). → Vitest на стор с общим хранилищем (Task 2).

## Grill-me — вопросы и принятые ответы

❓ **Q1 — Zustand или React context?**
Context: без зависимости, но при каждом «+» перерисовываются все ~50 плиток и бар; хранение, гидратацию и синхронизацию вкладок пришлось бы писать руками. Zustand 5 (~1 KB gzip, MIT): подписка по селектору (плитка перерисуется, только если изменилось её число), готовый `persist` с версией и миграцией, стор доступен вне React (тесты в node без браузера).
➡️ **Zustand.** Обоснование — в PROGRESS.md. `skipHydration: true` + `rehydrate()` после монтирования: сервер и первый рендер клиента видят пустую корзину, HTML совпадает.

❓ **Q2 — Как устроена позиция и как складываются одинаковые?**
➡️ `{ productSlug, variantId | null, addonIds[], removedIds[], qty }`. Ключ = slug | variant | отсортированные добавки | отсортированные убранные. Одинаковый ключ → qty суммируется (потолок 99 на позицию). Никаких цен и названий в позиции.

❓ **Q3 — Где считается цена на клиенте?**
➡️ Чистая функция `priceLine(line, catalog)` → `{ unit, total } | null`. `null` — позиция невалидна (нет блюда/варианта, добавка не разрешена категории, убираемый ингредиент не из списка). Каталог строится на сервере страницы из данных города; сервер заказа потом вызовет ту же функцию со своим каталогом точки. Пример из задачи: XXL 99 + sos usturoi 15 = 114 × 2 = **228**.

❓ **Q4 — Когда спрашивать про смену города?**
Варианты: при нажатии «сменить город» в шапке или при входе на страницу другого города.
➡️ **При входе на страницу другого города**, если в корзине есть позиции другого города. Так ловятся все пути (кнопка в шапке, ссылка из Google, закладка), и не спрашиваем зря, если человек выбрал тот же город. Текст «Ai schimbat orașul — …» тоже в прошедшем времени. «Continuă» — очистить и привязать к новому городу; «Anulează» (и Esc) — вернуться в старый город, корзина цела. Тап по фону ничего не делает (решение нужно явное). Пустая корзина — город меняется молча.

❓ **Q5 — Диалог смены города не нарушает «никаких всплывающих окон»?**
➡️ Это ответ на действие человека (сменил город), и архитектор прямо дал текст. Делаю тем же листом (Milk, снизу), `role="alertdialog"`, не отдельным «попапом». Фокус — на «Anulează» (наименее разрушительное).

❓ **Q6 — Что показывает счётчик на плитке и что делает «−»?**
➡️ Число = все штуки этого блюда в корзине (во всех настройках). «+» добавляет 1 шт. базовой конфигурации; «−» убирает 1 шт. базовой конфигурации (её и добавляет «+»), а если базовой нет — из последней позиции этого блюда; на 1 шт. позиция удаляется, плитка возвращается к жёлтому «+». *(Уточнено при реализации: сначала было «из последней добавленной», но позиция при сложении не переезжает в конец списка, и «−» мог бы убрать не то.)*

❓ **Q7 — Блюда с размерами: что на плитке после добавления?**
На 390px плитка ~171px: «de la 80 lei» + счётчик ± (~80px) не помещаются. И «−» для блюда с размерами неоднозначен.
➡️ «+» всегда открывает лист; после добавления кнопка становится Ink-кругом с числом (без ±), нажатие снова открывает лист. У блюд без размеров — Ink-пилюля «− N +».

❓ **Q8 — Что открывает лист: только фото и название или вся плитка?**
➡️ Название — настоящая `<button>` внутри `<h3>`, её невидимая область растянута на всю плитку (приём «stretched link»), кнопка «+»/счётчик — поверх. Одна точка табуляции на плитку, большая зона нажатия на телефоне. Тап по составу/цене тоже открывает лист — это ожидаемо.

❓ **Q9 — Нативный `<dialog>` или свой div?**
➡️ Нативный `<dialog>` + `showModal()`: браузер сам делает остальную страницу недоступной (фокус не уходит под лист), даёт Esc и верхний слой (никаких споров z-index с липкой шапкой). Анимация — CSS-переход на панели внутри; при закрытии держим диалог открытым, пока идёт выезд (180ms), затем `close()` — фокус возвращается на плитку. Прокрутка страницы блокируется `overflow: hidden` на `<html>` на время листа.

❓ **Q10 — Свайп вниз: откуда тянуть?**
Тянуть за ручку — мало места; тянуть за всё — конфликт с прокруткой содержимого.
➡️ Тянуть можно за любое место листа, **если содержимое прокручено до верха и палец идёт вниз** (решение принимается на первом движении: тогда отменяем прокрутку и двигаем лист). Закрыть — если утянули больше 25% высоты или быстро смахнули (скорость > 0.4 px/мс, «флик»; как в Vaul — drawer-библиотеке Эмиля Ковальски); иначе лист возвращается на место. Вверх лист не тянется. Альтернатива жесту — крестик (WCAG 2.5.7). Только телефон; на десктопе модалка без свайпа.

❓ **Q11 — Анимации: Motion или CSS?**
➡️ CSS-переходы (лист, фон, бар, счётчик) и одна короткая WAAPI-анимация (прыжок корзины). Они идут вне главного потока (не дёргаются, пока грузятся фото) и прерываемые; Motion для этого не нужен (скилл Эмиля). Длительности только из токенов DESIGN.md: вход листа 240ms (`--dur-base`), выход 150ms (`--dur-fast`, выход быстрее входа), нажатия 150ms. Прыжок корзины: translateY 0 → −6px → 0, 240ms, один раз на добавление; пока идёт — новый не запускается. Reduced-motion — всё мгновенно, прыжка нет.

❓ **Q23 — «+» нажали раньше, чем корзина подставилась из localStorage.** *(Найдено e2e-тестом.)*
➡️ Стор сам подставляет сохранённую корзину в момент первого добавления (localStorage синхронный) — нажатие не теряется и не затирает сохранённое.

❓ **Q24 — Комбо: «Fără» с частями набора.** *(Найдено при реализации.)* По правилу 7 «убрать всё, кроме основы» у Kebab Menu в «Fără» попали бы «kebab mic», «limonadă», «cartofi pai mic».
➡️ У категории Menu убирать нечего (одна строка в `products.ts` + тест). Вопрос архитектору.

❓ **Q12 — Бейдж на иконке корзины и «N poziții» — одно число?**
➡️ Текст «N poziții» = число позиций (так в e2e задачи: 2 шт. одной настройки = «1 poziție»). Бейдж = число штук (2). Для скринридера — одно атомарное сообщение `role="status"`: «1 poziție · 228 lei» при каждом изменении (ui-ux-pro-max: не голое число).

❓ **Q13 — Множественное число «poziție».**
Архитектор дал «poziție/poziții» и «позиция/позиции». По-румынски от 20 — «de poziții», по-русски 5–20 — «позиций».
➡️ `Intl.PluralRules`: ro one «poziție», few «poziții», other «de poziții»; ru one «позиция», few «позиции», many «позиций». Две формы («de poziții», «позиций») — мои, грамматические; в списке на утверждение.

❓ **Q14 — Тексты, которых нет в списке архитектора.**
Нужны подписи только для скринридера: крестик, − и + количества.
➡️ «Închide / Закрыть», «Scade cantitatea / Уменьшить количество», «Mărește cantitatea / Увеличить количество», «Cantitate / Количество» (группа счётчика). Видимых новых слов нет. Список — в PROGRESS.md на утверждение.

❓ **Q15 — Ценник в листе и корзине.**
DESIGN: «В листе блюда и корзине — крупнее: 800 18px, 32px». В листе цена уже на кнопке «Adaugă · 228 lei»; второй ценник с ценой за 1 шт. рядом с итогом за 2 шт. путает.
➡️ В листе — без отдельного ценника (цена на Primary). В корзине — большой ценник у каждой позиции (сумма позиции).

❓ **Q16 — Добавка: галочка или количество?**
➡️ Галочка (одна добавка каждого вида на блюдо). Цена справа «+15 lei» Manrope 600. Две одинаковые добавки — не в этой задаче.

❓ **Q17 — Что делает «−» в листе корзины на 1 шт.?**
➡️ Неактивен на 1 шт.; удалить — отдельной кнопкой «Șterge». Удалили последнюю позицию → лист корзины закрывается, бар уезжает.

❓ **Q18 — Десктоп: где корзина?**
DESIGN → Layout: «Десктоп: Cart Bar — кнопка в шапке».
➡️ ≥1024px: нижнего бара нет; в шапке справа появляется Primary-кнопка 40px (в шапку 56px кнопка 52px не влезает) «Coș · 228 lei» с иконкой и бейджем. Лист корзины — модалка 520px.

❓ **Q19 — Отступ снизу, чтобы бар не закрывал последние плитки.**
➡️ DESIGN → Layout: при непустой корзине у контента padding-bottom 88px (только телефон). Плюс `env(safe-area-inset-bottom)` у бара — на iPhone с полоской «домой» (при `viewport-fit=cover`, которого пока нет — вопрос в PROGRESS).

❓ **Q20 — Блюдо без фото в листе.**
➡️ Та же Sand-плитка с рисованной тарелкой, 280px высотой.

❓ **Q21 — Какой размер выбран по умолчанию?**
➡️ Первый (самый дешёвый: XL, mic). Цена на кнопке — сразу от него. Состав и граммы в листе меняются вместе с размером (у комбо свой состав).

❓ **Q22 — Картинки в клиентском листе: `images.json` в бандл?**
➡️ Нет. Размеры фото кладутся в каталог города на сервере; `FoodImage` делится на серверную обёртку (ищет в `images.json`) и чистый `FoodPicture` (получает размеры), который работает и в клиенте.

---

## File Structure

| Файл | Ответственность |
|---|---|
| `src/lib/cart/lines.ts` (+test) | Тип `CartLine`, zod-схема, `lineKey`, `addLine`, `setLineQty`, `removeLine`, `decrementLast`, `countOf`, `parsePersistedCart` |
| `src/lib/cart/pricing.ts` (+test) | Тип `Catalog`/`CatalogProduct`, `priceLine`, `cartTotal`, `pruneLines` |
| `src/lib/cart/catalog.ts` (+test) | `buildCatalog(citySlug)` — серверная сборка каталога города (цены точки, добавки категории, размеры фото) |
| `src/lib/cart/store.ts` (+test) | `createCartStore(storage)`, `cartStore`, `useCart(selector)`; действия add/setQty/remove/decrementLast/switchCity; persist |
| `src/components/sheet/sheet.tsx` | Нативный `<dialog>`: фон, панель, ручка, крестик, свайп, Esc, блок прокрутки, фокус |
| `src/components/sheet/use-sheet-drag.ts` | Жест «потянуть вниз» (touch), порог/скорость |
| `src/components/cart/cart-provider.tsx` | Контекст (город, язык, тексты, каталог, `openProduct`), гидратация стора, синхронизация вкладок, рендер листов/бара/диалога, `role=status` |
| `src/components/cart/product-sheet.tsx` | Содержимое листа блюда |
| `src/components/cart/quantity-stepper.tsx` | ± с числом (лист, корзина) |
| `src/components/cart/cart-bar.tsx`, `header-cart-button.tsx` | Бар снизу (телефон), кнопка в шапке (десктоп), прыжок иконки |
| `src/components/cart/cart-sheet.tsx` | Лист корзины |
| `src/components/cart/city-switch-dialog.tsx` | Подтверждение смены города |
| `src/components/menu/tile-open-button.tsx`, `tile-cart-control.tsx` | Островки плитки |
| `src/components/menu/food-image.tsx` | + `FoodPicture` (чистый) |
| `src/i18n/messages.ts` | Новые ключи `sheet`, `cart`, `a11y` |
| `src/app/globals.css` | Утилиты листа, бара, кнопок, счётчика |

---

### Task 1: Позиции корзины и цена (чистые функции)

**Files:** Create `src/lib/cart/lines.ts`, `src/lib/cart/pricing.ts`, `src/lib/cart/catalog.ts`; tests `src/lib/cart/lines.test.ts`, `src/lib/cart/pricing.test.ts`.

**Produces:**
- `type CartLine = { productSlug: string; variantId: string | null; addonIds: string[]; removedIds: string[]; qty: number }`
- `type LineConfig = Omit<CartLine, "qty">`
- `MAX_QTY = 99`; `lineKey(config): string`; `normalizeConfig(config): LineConfig`
- `addLine(lines, config, qty = 1): CartLine[]`; `setLineQty(lines, key, qty)`; `removeLine(lines, key)`; `decrementLast(lines, productSlug)`; `countOf(lines, productSlug): number`
- `PersistedCartSchema` + `parsePersistedCart(value): { city: CitySlug | null; lines: CartLine[] }`
- `type CatalogProduct = { slug; category; name; ingredients; grams; price; variants; removable; addonIds: string[]; photo: PhotoInfo | null }`, `type Catalog = { products: Record<string, CatalogProduct>; addons: Record<string, Addon> }`
- `priceLine(line, catalog): { unit: number; total: number } | null`; `cartTotal(lines, catalog): number`; `pruneLines(lines, catalog): CartLine[]`
- `buildCatalog(citySlug): Catalog`

- [ ] Тесты (RED): сложение одинаковых конфигураций (в т.ч. добавки в другом порядке); разные `removedIds` — разные позиции; потолок 99; `decrementLast` уменьшает последнюю позицию блюда и удаляет на 1; `countOf` суммирует настройки; `parsePersistedCart` — мусор → пусто, qty 0/1000 → позиция выкинута; `priceLine`: Kebab XL/XXL + XXL + sos-usturoi × 2 = 228; базовая цена без варианта; вариант обязателен для блюда с вариантами; добавка чужой категории → null; неизвестный убираемый → null; `buildCatalog("soroca")` без пиццы, у кебаба разрешены ингредиентные добавки, у напитков — нет.
- [ ] Реализация → GREEN. `npm test`.

### Task 2: Стор корзины (Zustand + persist)

**Files:** `npm i zustand`; Create `src/lib/cart/store.ts`, test `src/lib/cart/store.test.ts`.

**Consumes:** Task 1. **Produces:** `createCartStore(getStorage)`, `cartStore`, `useCart(selector)`, `CART_STORAGE_KEY = "apetit.cart"`; state `{ city, lines, hydrated, bump }`; actions `add(city, config, qty?) → boolean`, `setQty(key, qty)`, `remove(key)`, `decrementLast(slug)`, `switchCity(city)`, `prune(catalog)`.

- [ ] Тесты (RED) на vanilla-сторе с подменённым хранилищем: `add` в пустую корзину привязывает город; `add` при чужом городе и непустой корзине → `false`, ничего не меняется; `switchCity` очищает позиции и ставит город; состояние пишется в хранилище и восстанавливается `rehydrate()`; мусор в хранилище → пустая корзина; две «вкладки» с общим хранилищем — после `rehydrate()` вторая видит позиции первой; `bump` растёт на каждое добавление и не сохраняется.
- [ ] Реализация → GREEN.

### Task 3: Тексты

**Files:** Modify `src/i18n/messages.ts` (+ интерфейс).
Ключи: `sheet.{add, size, without, extra, free, close}`, `cart.{title, positions{one,few,many,other}, total, remove, order, open}`, `citySwitch.{title, confirm, cancel}`, `a11y.{decrease, increase, quantity}`. Тест равенства ключей уже есть.

### Task 4: Лист (общий) + лист блюда

**Files:** Create `src/components/sheet/sheet.tsx`, `use-sheet-drag.ts`, `src/components/cart/product-sheet.tsx`, `quantity-stepper.tsx`; Modify `food-image.tsx`, `globals.css`.
- Лист: `<dialog>` на весь экран, фон `--scrim`, панель Milk снизу (телефон) / 520px по центру (≥1024). `data-state` open/closed → CSS transform/opacity. Закрытие: крестик, тап по фону, Esc (`cancel`), свайп. Фокус возвращается на кнопку, открывшую лист.
- Лист блюда: фото 280px (`FoodPicture` / заглушка), название Oswald 22px caps, состав 13px Charcoal (по варианту), граммы Smoke; блоки через hairline: MĂRIME (сегменты, активный Yellow, `role="radiogroup"`), FĂRĂ … gratuit (галочки), EXTRA (галочки + «+15 lei» справа); sticky низ: ± и Primary «Adaugă · N lei». `scroll-padding-bottom` под sticky-низ.

### Task 5: Корзина на странице

**Files:** Create `cart-provider.tsx`, `cart-bar.tsx`, `header-cart-button.tsx`, `cart-sheet.tsx`, `city-switch-dialog.tsx`, `tile-open-button.tsx`, `tile-cart-control.tsx`; Modify `product-tile.tsx`, `site-header.tsx`, `src/app/[city]/page.tsx`, `globals.css`.

### Task 6: e2e + скриншоты

**Files:** Create `e2e/cart.spec.ts`, `e2e-screens/cart.screens.ts`.
- Сценарий задачи (390px): открыть «Kebab XL / XXL» → XXL → «Sos de usturoi» → + до 2 → кнопка «Adaugă · 228 lei» → бар «1 poziție» и «228 lei» → открыть корзину → «Șterge» → бара нет.
- «+» на плитке без размеров → счётчик 1, фокус на «+»; «−» → снова «+»; Esc закрывает лист, фокус на название плитки; корзина переживает перезагрузку; корзина Сорок + /briceni → диалог; «Anulează» → /soroca с корзиной; «Continuă» → пустая.
- Скриншоты `04-produs-390.png`, `04-cos-390.png`, `04-produs-1280.png`.

### Task 7: Проверка и отчёт

- [ ] `web-design-guidelines` и `review-animations` по новым файлам, правки.
- [ ] `npm run lint`, `npm run build` (код выхода), `npm test`, `npm run test:e2e`, `npm run screens`.
- [ ] PROGRESS.md; коммит `feat: product sheet and cart`, push.
