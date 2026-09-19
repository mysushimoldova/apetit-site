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
    "connect-src": ["'self'"],
    "frame-ancestors": ["'none'"],
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
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: "geolocation=(self), camera=(), microphone=(), payment=()",
    },
    { key: "Content-Security-Policy", value: contentSecurityPolicy(isDev) },
  ];
}
