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
