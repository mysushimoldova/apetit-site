// Страница «такого адреса нет» для всего сайта.
//
// Зачем отдельный файл: у сайта два корневых layout (румынский и русский,
// src/app/(ro) и src/app/ru), поэтому обычный app/not-found.tsx Next
// показать не может — неизвестные адреса до сих пор получали его
// встроенную страницу, у которой нет ни нашего вида, ни даже языка у
// <html> (axe: serious, html-has-lang). Здесь страница своя, целиком.
//
// Этот файл в обход layout, поэтому стили и шрифты подключаются в нём.
import Link from "next/link";
import type { Metadata } from "next";
import { pageBackground, productsConfig } from "@/config/motion";
import { paths } from "@/i18n/routes";
import { fontVariables } from "@/lib/fonts";
import { rootCss } from "@/lib/root-css";
import "@/app/globals.css";

export { viewport } from "@/routes/root";

export const metadata: Metadata = {
  title: "404 · Apetit",
};

export default function GlobalNotFound() {
  return (
    // Румынский — основной язык сайта (SPEC §7)
    <html lang="ro" className={fontVariables}>
      <body suppressHydrationWarning>
        <style
          dangerouslySetInnerHTML={{
            __html: rootCss(pageBackground, productsConfig),
          }}
        />
        <main className="page flex min-h-dvh flex-col items-center justify-center gap-6 text-center">
          <h1 className="font-display text-[86px] leading-none">404</h1>
          {/* Текста для этой страницы ещё нет — запрошен у владельца
              (PROGRESS.md). Пока стоит заглушка, как требует CLAUDE.md. */}
          <p className="font-body text-body text-charcoal">
            [ТЕКСТ: короткая фраза «такой страницы нет» — ro и ru]
          </p>
          <Link href={paths.home()} className="btn-primary px-8">
            Apetit
          </Link>
        </main>
      </body>
    </html>
  );
}
