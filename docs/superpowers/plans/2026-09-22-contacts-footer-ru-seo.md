# План: контакты, подвал, русские адреса /ru/, SEO (22.09.2026)

## Решения

1. **Маршруты.** Два корневых layout через группы маршрутов (Next 16 →
   «multiple root layouts»): `app/(ro)/layout.tsx` (`<html lang="ro">`) и
   `app/ru/layout.tsx` (`<html lang="ru">`). Страницы — тонкие файлы, тело
   общее в `src/routes/*`. Никакого proxy/rewrites: всё статика, `/ro/...`
   не существует. Переход между языками — полная загрузка страницы (так
   устроены корневые layout); корзина, город, черновик формы — в хранилище.
2. **Язык.** Из URL: `/ru/...` → ru, иначе ro. Помощники в
   `src/i18n/routes.ts`: `localePath`, `parseLocalePath`, `switchLocalePath`.
   Явный выбор посетителя (клик RO/RU) — `localStorage apetit.lang`;
   он решает язык плиток на `/` и редиректа с `/`; иначе — язык города
   (Otaci → ru).
3. **Переключатель** — ссылки `<a hreflang>` на тот же путь в другом языке;
   клик сохраняет `apetit.lang`. Черновик формы оформления (имя, телефон,
   адрес, точка) — `sessionStorage apetit.checkout-draft`, стирается после
   заказа.
4. **SEO.** `metadataBase` = https://apetit.md; `alternates.canonical` +
   `languages {ro, ru, x-default→ro}` на каждой странице; OG/Twitter;
   `app/sitemap.ts`, `app/robots.ts`; JSON-LD Restaurant / BreadcrumbList /
   Organization. OG-картинки — статические PNG в `public/og/`, собираются
   скриптом `scripts/og-images.mjs` со страницы `/dev/og` (только dev).
5. **Контакты** — `/contacte`, `/ru/contacte`: Oswald-заголовок, строка
   часов, Point Card на точку (название, адрес, tel:, «Comandă» Secondary,
   «Vezi pe hartă», «Lasă o recenzie» — текстовые ссылки), соцсети текстом.
6. **Подвал** — общий `SiteFooter` на всех страницах, кроме `/` и `/ru`.

## Шаги
1. routes.ts + lang-storage + тесты (vitest)
2. Перенос страниц в `(ro)` и `ru`, общие тела в `src/routes`
3. Шапка: LangSwitch, город из хранилища; подвал общий
4. Контакты + тексты ro/ru
5. SEO: metadata, sitemap, robots, JSON-LD, OG-картинки
6. Тесты e2e, lint, build, Lighthouse, скриншоты, отчёт
