// Корневой layout — общий для двух языков. У румынского (app/(ro)) и
// русского (app/ru) свои корневые layout (Next 16 → «multiple root layouts»):
// так у <html> правильный lang, а переход между языками — полная загрузка
// страницы. Оба layout импортируют globals.css, зовут RootHtml и берут отсюда
// viewport и метаданные.
import type { Viewport } from "next";
import { pageBackground } from "@/config/motion";
import type { Locale } from "@/data/points";
import { fontVariables } from "@/lib/fonts";
import { pageThemeStyle } from "@/lib/page-theme";

export { rootMetadata } from "@/lib/seo";

export const viewport: Viewport = {
  // Цвет фона страницы — из src/config/motion.json (панель /dev/motion)
  themeColor: pageBackground,
  width: "device-width",
  initialScale: 1,
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
    <html
      lang={locale}
      className={fontVariables}
      style={pageThemeStyle(pageBackground)}
    >
      {/* suppressHydrationWarning: расширения браузера дописывают в <body>
          свои атрибуты, и без этого Next ругается на несовпадение HTML. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
