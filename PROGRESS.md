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
