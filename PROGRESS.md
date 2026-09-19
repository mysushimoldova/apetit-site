# PROGRESS.md — журнал работ по сайту apetit.md

Новые записи добавляются в конец. Каждая запись: дата, этап, что сделано,
что не получилось, что нужно от Амяна. Этот файл Амян отправляет архитектору
после каждой задачи.

---

## 2026-09-19 — Этап 4 — настройка проекта

### Проверка инструментов

| Инструмент | Статус |
|---|---|
| git | 2.55.0 — есть |
| Claude Code | 2.1.266 — есть |
| Node.js / npm | **НЕТ** — не установлен |
| Python | **НЕТ** — не установлен (есть только пустая заглушка Microsoft Store) |

### Что сделано
- Подключён MCP-сервер **Context7** (актуальная документация библиотек):
  `claude mcp add --transport http context7 https://mcp.context7.com/mcp`.
  Проверка `claude mcp list` — статус Connected. Конфиг лежит локально
  в `~/.claude.json` для этого проекта, в git не попадает.
- В репозиторий добавлены `CLAUDE.md`, `SPEC.md`, `DESIGN.md` (дизайн-система),
  `docs/fon-variante.png` и этот журнал.

### Что не встало
**Ни один скилл не установлен.** Все команды `npx skills add …` требуют
Node.js, а его на компьютере нет. Пропущены все 17 команд:

- `anthropics/skills`: frontend-design, webapp-testing
- `nextlevelbuilder/ui-ux-pro-max-skill`: ui-ux-pro-max
- `emilkowalski/skills`: emil-design-eng, animate, improve-animations,
  review-animations, apple-design
- `vercel-labs/agent-skills`: web-design-guidelines, react-best-practices,
  composition-patterns
- `obra/superpowers` (весь набор)
- `mattpocock/skills`: grill-me, code-review, diagnosing-bugs,
  git-guardrails-claude-code, handoff

Папка `.claude/skills/` пока не создана. Коммит сделан без скиллов, поэтому
сообщение коммита отличается от запланированного («add project skills…»):
`chore: add project docs, design system and progress log`.

### Что нужно от Амяна
1. **Установить Node.js LTS** — https://nodejs.org/ (кнопка «Download Node.js (LTS)»,
   установщик для Windows). npm ставится вместе с ним. Без Node.js не заработает
   ни установка скиллов, ни сам Next.js. После установки перезапустить VS Code.
2. **Установить Python 3** — https://www.python.org/downloads/ (кнопка «Download
   Python 3.x»). При установке обязательно поставить галочку **«Add python.exe
   to PATH»**. Нужен для скиллов `ui-ux-pro-max` (поиск по базе дизайн-правил)
   и `webapp-testing` (скрипты Playwright). Если после установки команда
   `python --version` по-прежнему открывает Microsoft Store — выключить
   псевдоним: Параметры → Приложения → Дополнительные параметры приложений →
   Псевдонимы выполнения приложений → отключить `python.exe` и `python3.exe`.
3. После установки повторить шаг 2 этапа 4 (все команды `npx skills add …`,
   агент — Claude Code) и сделать коммит `chore: add project skills`.

### Вопросы
- Нет.

---

## 2026-09-19 — Этап 4 — установка скиллов (повтор шага 2)

### Проверка инструментов

| Инструмент | Статус |
|---|---|
| Node.js | v24.21.0 — есть |
| npm | 11.19.0 — есть |
| Python | 3.14.7 — есть (`py --version` и `python --version` работают, Store не открывается) |
| gh (GitHub CLI) | 2.101.0 — есть, вход под mysushimoldova |

Замечание: Node.js прописан в системном PATH, но окно VS Code, из которого
шла работа, было открыто до его установки и Node не видело. В этой сессии путь
добавлялся вручную; после перезапуска VS Code всё работает само.

### Что сделано
- Установлены все скиллы в папку проекта `.claude/skills/` (агент — Claude Code,
  не глобально). Итого 31 папка:
  - `anthropics/skills`: frontend-design, webapp-testing
  - `nextlevelbuilder/ui-ux-pro-max-skill`: ui-ux-pro-max
  - `emilkowalski/skills`: emil-design-eng, animate, improve-animations,
    review-animations, apple-design
  - `vercel-labs/agent-skills`: web-design-guidelines,
    vercel-react-best-practices, vercel-composition-patterns
  - `obra/superpowers` (весь набор, 15 скиллов): brainstorming,
    diagnosing-superpowers, dispatching-parallel-agents, executing-plans,
    finishing-a-development-branch, receiving-code-review,
    requesting-code-review, subagent-driven-development, systematic-debugging,
    test-driven-development, using-git-worktrees, using-superpowers,
    verification-before-completion, writing-plans, writing-skills
  - `mattpocock/skills`: grill-me, code-review, diagnosing-bugs,
    git-guardrails-claude-code, handoff
- В корне появился `skills-lock.json` — его создаёт `npx skills`, он фиксирует,
  откуда и какой версии каждый скилл. Закоммичен вместе со скиллами.
- Проверено, что `ui-ux-pro-max` запускается на Python 3.14
  (`py -3 scripts/search.py "fast food restaurant" --design-system` выдаёт результат).
- Выполнен `gh auth setup-git`: для github.com git теперь берёт токен из
  GitHub CLI, а не из Git Credential Manager (который открывал окно и вешал
  `git push`). Настройка в `~/.gitconfig`, в репозиторий не попадает.

### Что не встало / отличия от задания
- В `vercel-labs/agent-skills` скиллов с именами `react-best-practices` и
  `composition-patterns` больше нет — в репозитории их переименовали в
  `vercel-react-best-practices` и `vercel-composition-patterns`. Установлены
  под новыми именами (репозиторий тот же, содержимое то же). В CLAUDE.md
  упоминается только `web-design-guidelines`, поэтому правки там не нужны.
- Всё остальное встало с первого раза.

### Что нужно от Амяна
1. Перезапустить VS Code (закрыть полностью и открыть заново), чтобы новое
   окно видело Node.js без ручного добавления пути.
2. Ничего больше не требуется.

### Вопросы
- Нет.

---

## 2026-09-19 — Этап 5 — каркас проекта

### Что сделано
- Создан проект **Next.js 15.5.25** (App Router, TypeScript strict, `src/`,
  alias `@/`), сборщик Turbopack. Менеджер пакетов — npm. Проект создан
  командой `create-next-app@15` во временной папке и перенесён сюда, потому что
  CLI отказывается работать в непустой папке. Существующие файлы не тронуты.
- **Tailwind CSS 4.3.3.** Вся дизайн-система из DESIGN.md переведена в
  `src/app/globals.css`:
  - цвета (Cream, Milk, Sand, Yellow, Yellow Deep, Ink, Charcoal, Smoke, Ash,
    Open, Closed, Peach Glow) — как CSS-переменные и утилиты Tailwind
    (`bg-cream`, `text-ink`, `bg-yellow`…). Стандартные цвета Tailwind
    (white, gray, purple…) **отключены** — по DESIGN.md чистый белый/серый
    запрещены, так их просто нельзя случайно использовать;
  - радиусы (`rounded-pill`, `rounded-card`, `rounded-tile`, `rounded-sheet`,
    `rounded-input`, `rounded-image`, `rounded-badge`), тени (`shadow-card`,
    `shadow-lift`, `shadow-glass`), кривая `ease-out`, длительности
    `--dur-fast/base/slow` (при `prefers-reduced-motion` = 0), переменные
    стекла и фоновых пятен;
  - шкала текста из таблицы Type Scale: `text-caption … text-city` — каждая
    сразу задаёт размер, межстрочный интервал и жирность;
  - утилиты `page` (контейнер 1200px, отступы 16px на телефоне / 40px с 1024px)
    и `glass` (стекло с запасным вариантом без blur).
- **Шрифты** — `src/lib/fonts.ts`: Oswald 600, Manrope 600/700/800,
  Montserrat 400/500, subsets latin + latin-ext + cyrillic, через
  `next/font/google`. Проверено: при сборке 16 файлов woff2 легли в
  `.next/static/media`, в HTML нет ни одной ссылки на Google — с CDN ничего
  не грузится.
- **Библиотеки** (только три, все из утверждённого стека):
  - `motion` 13.4.0 — анимации из SPEC 6.3 (появление городов, карточек,
    корзина). Уважает reduced-motion, лёгкая.
  - `lucide-react` 1.47.0 — иконки (DESIGN.md → Imagery: «Иконки — Lucide»).
  - `zod` 4.6.5 — валидация входных данных на сервере (CLAUDE.md, SPEC 9.4).
- **Инструменты качества:** Prettier 3.9.8 (форматирует только код, `.md`
  и документы не трогает), Vitest 5.0.1 (один тест: сторожит, что в токенах
  есть фирменный жёлтый и нет чистого белого/чёрного), Playwright 1.63.0
  (один smoke-тест: главная открывается на профиле телефона и содержит
  APETIT; браузер Chromium установлен). Скрипты: `dev`, `build`, `lint`,
  `test`, `test:e2e`, плюс `format` / `format:check`.
- **Временная главная:** на Cream слово APETIT (Oswald 44px), строка городов
  (Manrope 700), строка с румынскими ș ț ă â î (Montserrat 400) и русская
  строка (Montserrat 500). Скриншот на 390px проверен — все шрифты и символы
  отрисовываются.
- `.gitignore` дополнен для Next.js: node_modules, .next, .env*, test-results,
  playwright-report и т.д.
- Все проверки проходят: `npm run build` ✓, `npm run lint` ✓, `npm test`
  (2 теста) ✓, `npm run test:e2e` (1 тест) ✓.

### Что не встало / отличия от задания
- **Правка CLAUDE.md не понадобилась:** имён `react-best-practices` и
  `composition-patterns` в файле нет (это уже отмечалось в отчёте этапа 4).
  Файл не менял.
- **Context7 в этой сессии недоступен** как инструмент (MCP-сервер настроен
  в `~/.claude.json`, но в текущем окне Claude Code его нет в списке).
  Документацию Next.js 15 / next/font и Tailwind v4 / `@theme` проверил
  напрямую на nextjs.org и tailwindcss.com. Стоит проверить `claude mcp list`
  в новом окне.
- **Контейнер: DESIGN.md говорит 1120px, задача — 1200px.** Сделал 1200 как
  в задаче (`--container-page`). Если правильное значение 1120 — одна строка
  в `globals.css`, и DESIGN.md тогда уже верен.
- `@types/node` поднят с 20 до 24 (у нас Node 24, а Vitest 5 требует ≥22) —
  иначе установка падала с конфликтом.
- `npm audit` показывает 2 уязвимости в **postcss, который лежит внутри
  самого Next.js 15** (используется только при сборке, не в браузере).
  Единственное «лечение» по npm — переход на Next.js 16, что противоречит
  SPEC 9.1. Оставил как есть; вопрос архитектору ниже.
- Тексты на временной главной захардкожены (системы переводов ещё нет) —
  это временная страница, она целиком заменится экраном городов.
- Скиллы `superpowers` (using-superpowers) и проверка документации выполнены;
  `ui-ux-pro-max` / `web-design-guidelines` не запускал — интерфейса как
  такового на этом этапе нет, только токены и одна проверочная страница.

### Как запустить сайт и посмотреть в браузере (пошагово)
1. Открыть VS Code с папкой `C:\apetit-site`.
2. Открыть терминал: меню **Terminal → New Terminal** (или `Ctrl` + `` ` ``).
3. Ввести `npm run dev` и нажать Enter. Через несколько секунд появится
   строка вида `- Local: http://localhost:3000`.
4. Открыть в браузере адрес **http://localhost:3000** — это и есть сайт.
   Внизу слева будет маленький кружок с буквой N — это служебный значок
   режима разработки, на настоящем сайте его не будет.
5. Остановить сайт: щёлкнуть в терминал и нажать `Ctrl` + `C`.

Другие команды (тоже в терминале):
- `npm run build` — собрать сайт как для боевого сервера (проверка, что всё
  компилируется);
- `npm run lint` — проверка кода линтером;
- `npm test` — быстрые тесты; `npm run test:e2e` — тест в настоящем браузере
  (сам поднимает сайт и сам его гасит).

### Что нужно от Амяна
1. Ничего устанавливать не нужно — всё стоит. Один раз запустить `npm run dev`
   и посмотреть страницу — убедиться, что шрифты выглядят как в печатном меню.
2. Передать архитектору отчёт и вопросы ниже.

### Вопросы архитектору
1. Ширина контейнера: 1200px (задача) или 1120px (DESIGN.md)?
2. Уязвимости postcss внутри Next.js 15 (build-time). Оставляем Next 15 по
   SPEC или разрешаем Next 16? Если оставляем — предлагаю просто зафиксировать
   это в SPEC как известный и принятый риск.
3. Context7 не виден в этой сессии — проверить настройку MCP в новом окне?
