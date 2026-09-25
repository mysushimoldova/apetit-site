// Защитные заголовки для всех страниц (SPEC §9.4). Подключаются в
// next.config.ts → headers(). Отдельный файл — чтобы проверить тестом.
//
// CSP без nonce — осознанно. Nonce в Next 16 работает только при
// динамическом рендере КАЖДОЙ страницы (docs: content-security-policy →
// «you must use dynamic rendering to add nonces»): меню перестало бы быть
// статическим (SPEC §9.5), каждый заход считался бы на сервере Cloudflare.
// Поэтому script-src 'self' 'unsafe-inline': Next кладёт в статический
// HTML свои инлайн-скрипты (данные страницы для React), плюс наши два
// маленьких скрипта «до отрисовки» (редирект на город, язык правовых
// страниц). Чужие домены при этом запрещены полностью: скрипт с другого
// сайта не загрузится, данные никуда, кроме нашего сервера, не уйдут.
// style-src 'unsafe-inline' — анимации (Motion) и размеры вывесок задаются
// атрибутом style. 'unsafe-eval' — только в dev: React в разработке
// восстанавливает через eval стек серверных ошибок.

export interface Header {
  key: string;
  value: string;
}

export function contentSecurityPolicy(isDev: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:"],
    "font-src": ["'self'"],
    // Ролики заставки категории лежат у нас же, в /splash. blob: — это
    // те же ролики: заставка скачивает их fetch-ем с низким приоритетом и
    // отдаёт <video> из памяти (src/motion/splash/videos.ts). Адрес blob:
    // может создать только скрипт самого сайта, чужой файл так не зайдёт.
    "media-src": ["'self'", "blob:"],
    "connect-src": ["'self'"],
    // Боевой сайт не даёт вставлять себя в рамку. В разработке панель
    // /dev/motion показывает страницу меню в <iframe> своего же адреса,
    // поэтому там — 'self' (и X-Frame-Options ниже — SAMEORIGIN).
    "frame-ancestors": [isDev ? "'self'" : "'none'"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

export function securityHeaders(isDev: boolean): Header[] {
  return [
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: isDev ? "SAMEORIGIN" : "DENY" },
    {
      key: "Permissions-Policy",
      value: "geolocation=(self), camera=(), microphone=(), payment=()",
    },
    // Сайт ничего не открывает в window.open и не даёт встраивать себя —
    // поэтому обе стороны «закрыты по умолчанию»: COOP отрезает нашу вкладку
    // от той, что её открыла (чужая страница не дотянется до window.opener),
    // CORP запрещает чужим сайтам подключать наши фото и шрифты как свои.
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    { key: "Content-Security-Policy", value: contentSecurityPolicy(isDev) },
  ];
}
