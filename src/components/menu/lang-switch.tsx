"use client";
// Переключатель RO/RU в шапке (SPEC §7): ссылки на тот же экран в другом
// языке (/soroca ↔ /ru/soroca). Текущий язык — не ссылка, а подписанный
// текст. Нажатие запоминает выбор на устройстве (src/lib/lang-storage.ts) —
// его уважают плитки на «/» и редирект с «/». Переход — полная загрузка
// страницы (у языков разные корневые layout): корзина, город и черновик
// формы лежат в хранилище и не теряются.
import { usePathname } from "next/navigation";
import type { Locale } from "@/data/points";
import { LOCALES, switchLocalePath } from "@/i18n/routes";
import { saveLang } from "@/lib/lang-storage";

export function LangSwitch({
  locale,
  label,
}: {
  locale: Locale;
  /** Подпись для скринридера: «Limba» / «Язык» */
  label: string;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="lang-switch">
      {LOCALES.map((code, i) => (
        <span key={code} className="flex items-center">
          {i > 0 && (
            <span className="text-smoke" aria-hidden="true">
              /
            </span>
          )}
          {code === locale ? (
            <span aria-current="page" lang={code}>
              {code.toUpperCase()}
            </span>
          ) : (
            <a
              href={switchLocalePath(pathname, code)}
              hrefLang={code}
              lang={code}
              onClick={() => saveLang(code)}
            >
              {code.toUpperCase()}
            </a>
          )}
        </span>
      ))}
    </nav>
  );
}
