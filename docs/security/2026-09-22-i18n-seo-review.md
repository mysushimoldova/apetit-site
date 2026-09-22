# Отчёт безопасности — контакты, подвал, /ru/, SEO (22.09.2026)

Проверка по `owasp-security` + `differential-review` (быстрый разбор:
диффа без auth/крипто/платежей, стратегия MEDIUM/FOCUSED). Диапазон —
рабочее дерево против `e19deae`.

## Что менялось и уровень риска

| Файлы | Риск | Почему |
|---|---|---|
| `src/server/order/actions.ts` | — | Только переезд из `app/[city]/comanda/`, содержимое байт в байт то же (`git diff -M`: 0 строк) |
| `src/lib/city-redirect-script.ts` | MEDIUM | Inline-скрипт в `<body>`: читает `localStorage`, зовёт `location.replace` |
| `src/components/seo/json-ld.tsx`, `src/lib/schema-org.ts` | MEDIUM | `dangerouslySetInnerHTML` с JSON-LD |
| `src/components/menu/lang-switch.tsx`, `src/i18n/routes.ts` | MEDIUM | `href` собирается из `usePathname()` |
| `src/lib/order/draft.ts` | MEDIUM | Чтение `sessionStorage` в форму |
| `src/app/sitemap.ts`, `src/app/robots.ts` | LOW | Статические списки из данных |
| `src/app/(ro)/dev/og/page.tsx` | LOW | Только dev; `searchParams.city` сверяется со списком городов |
| Маршруты, шапка, подвал, контакты, тексты, тесты | LOW | UI |

## Разбор MEDIUM

1. **Inline-скрипт редиректа.** Строка собирается только из констант
   (`CITY_STORAGE_KEY`, `LANG_STORAGE_KEY`, список slug городов, `RU_PREFIX`)
   через `JSON.stringify`; значения из хранилища сравниваются с regex
   `^(soroca|sculeni|otaci|briceni)$` и с литералами `"ru"`/`"ro"`, а не
   вставляются в адрес. Результат `location.replace` — всегда
   `"/"+slug` или `"/ru/"+slug`. Мусор в хранилище → ничего не происходит
   (unit-тесты: «chisinau», «soroca/../admin», пустая строка, исключение
   `localStorage`). CSP не менялся (`script-src 'self' 'unsafe-inline'` —
   как и раньше, обосновано в отчёте от 19.09).
2. **JSON-LD.** Данные — только из `src/data` (точки, компания, тексты),
   пользовательского ввода нет. На всякий случай `serializeJsonLd`
   экранирует `<` → `<`, поэтому строка не может закрыть `</script>`
   (тест). Тип `application/ld+json` браузером не исполняется.
3. **Переключатель языка.** `switchLocalePath` строит адрес из `pathname`.
   Найдено и исправлено в ходе проверки: адрес вида `//evil.com` дал бы
   protocol-relative ссылку на чужой сайт. Теперь двойные косые черты
   схлопываются, путь всегда начинается с одной `/` (тест «лишние косые
   черты в начале не дают ссылку на чужой сайт»). На практике шапка
   рисуется только на существующих маршрутах, но защита дешёвая.
   `hrefLang`/`lang` — литералы `"ro"`/`"ru"`.
4. **Черновик формы.** `parseDraft` принимает только строки не длиннее
   лимитов формы (имя 40, телефон 15, адрес 120) и `pointId` по
   `^[a-z-]{1,40}$`, который дополнительно сверяется со списком точек
   страницы; чужое/битое → пустое поле. Хранилище — `sessionStorage`
   (одна вкладка), стирается после успешного заказа. На сервер черновик
   не уходит: отправка идёт прежним путём через zod-схему.
5. **`/dev/og`.** `notFound()` вне `development` (проверка в
   `e2e-prod/dev-routes.spec.ts`: 404 и с `?city=`). `city` из query
   ищется в `CITIES` — иначе 404, в разметку попадает только `city.name`
   из данных.

## Что не изменилось (проверено)

- Защитные заголовки и CSP (`next.config.ts`, `src/lib/security-headers.ts`)
  не трогались; e2e «заголовки на …» и «заказ проходит с CSP» зелёные.
- Оформление заказа: серверная проверка, лимиты, honeypot — код тот же,
  изменились только адреса ссылок и `router.replace` (через `localePath`).
- `robots.txt` закрывает `/admin`, `/api/`, `/dev/`, страницы `…/comanda`
  на обоих языках; sitemap личных страниц не содержит; у оформления и
  подтверждения `robots: noindex, nofollow`.

## Покрытие тестами

Vitest: `routes.test.ts` (31, включая protocol-relative), `lang-storage`,
`city-redirect-script` (9), `draft` (4), `schema-org` (6), `seo` (5),
`sitemap` (3), `places` (2). Playwright `i18n-seo.spec.ts` (25) — ветки
языков, переключатель с корзиной и черновиком, контакты, подвал,
sitemap/robots, JSON-LD, OG.

## Вывод

Уязвимостей не найдено. Одно место укреплено превентивно (пункт 3).
Ограничение отчёта: разбор быстрый, без моделирования атакующего —
в диффе нет кода авторизации, платежей и внешних вызовов.
