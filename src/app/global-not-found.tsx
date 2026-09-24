// Страница «такого адреса нет» для всего сайта.
//
// Зачем отдельный файл: у сайта два корневых layout (румынский и русский,
// src/app/(ro) и src/app/ru), поэтому обычный app/not-found.tsx Next
// показать не может — неизвестные адреса до сих пор получали его
// встроенную страницу, у которой нет ни нашего вида, ни даже языка у
// <html> (axe: serious, html-has-lang). Здесь страница своя, целиком.
//
// Этот файл в обход layout, поэтому стили и шрифты подключаются в нём.
import type { Metadata } from "next";
import { NotFoundBody } from "@/components/not-found/not-found-body";
import { pageBackground, productsConfig } from "@/config/motion";
import { fontVariables } from "@/lib/fonts";
import { rootCss } from "@/lib/root-css";
import "@/app/globals.css";

export { viewport } from "@/routes/root";

export const metadata: Metadata = {
  title: "404 · Apetit",
};

export default function GlobalNotFound() {
  return (
    // Румынский — основной язык сайта (SPEC §7). На адресах /ru/… язык
    // и тексты меняет NotFoundBody сразу после сверки HTML.
    <html lang="ro" className={fontVariables}>
      <body suppressHydrationWarning>
        <style
          dangerouslySetInnerHTML={{
            __html: rootCss(pageBackground, productsConfig),
          }}
        />
        <NotFoundBody />
      </body>
    </html>
  );
}
