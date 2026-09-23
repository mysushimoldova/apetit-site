// Корневой layout — общий для двух языков. У румынского (app/(ro)) и
// русского (app/ru) свои корневые layout (Next 16 → «multiple root layouts»):
// так у <html> правильный lang, а переход между языками — полная загрузка
// страницы. Оба layout импортируют globals.css, зовут RootHtml и берут отсюда
// viewport и метаданные.
import type { Viewport } from "next";
import { pageBackground, productsConfig } from "@/config/motion";
import type { Locale } from "@/data/points";
import { fontVariables } from "@/lib/fonts";
import { rootCss } from "@/lib/root-css";

export { rootMetadata } from "@/lib/seo";

export const viewport: Viewport = {
  // Цвет фона страницы — из src/config/motion.json (панель /dev/motion)
  themeColor: pageBackground,
  width: "device-width",
  initialScale: 1,
  // Телефон не приближается щипком и двойным тапом: сайт статичен, как
  // печатное меню. Второй замок — touch-action в globals.css: iOS Safari
  // сам по себе maximum-scale и user-scalable не слушается.
  // На компьютере это ни на что не влияет (Ctrl+колесо работает как всегда).
  maximumScale: 1,
  userScalable: false,
  // Страница заходит под «чёлку» и полоску «домой» iPhone; отступы от них —
  // env(safe-area-inset-*) в globals.css (шапка, лист, панель корзины)
  viewportFit: "cover",
};

export function RootHtml({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <html lang={locale} className={fontVariables}>
      {/* suppressHydrationWarning: расширения браузера дописывают в <body>
          свои атрибуты, и без этого Next ругается на несовпадение HTML. */}
      <body suppressHydrationWarning>
        {/* Переменные CSS из motion.json — правилом :root, а не атрибутом
            style у <html>: см. src/lib/root-css.ts. */}
        <style
          dangerouslySetInnerHTML={{
            __html: rootCss(pageBackground, productsConfig),
          }}
        />
        {children}
      </body>
    </html>
  );
}
