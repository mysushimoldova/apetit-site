"use client";
// Содержимое страницы «такого адреса нет».
//
// Почему клиентский компонент: global-not-found.tsx в Next 16 не получает ни
// адреса, ни параметров — он один на весь сайт. Поэтому язык страницы
// определяется здесь, по адресу в браузере (/ru/… → русский), а кнопка ведёт
// в меню сохранённого города или, если города нет, на экран городов.
//
// Сервер и первая сверка HTML отдают румынский — основной язык сайта
// (SPEC §7). Сразу после сверки, если адрес русский, текст и атрибут lang у
// <html> меняются на русский: так же, как здесь появляется сохранённый город.
import Link from "next/link";
import { useEffect } from "react";
import { getMessages } from "@/i18n/messages";
import { localePath, paths } from "@/i18n/routes";
import { useSavedCity } from "@/lib/use-saved-city";
import { useUrlLocale } from "@/lib/use-url-locale";

export function NotFoundBody() {
  const locale = useUrlLocale();
  const city = useSavedCity();
  const t = getMessages(locale).notFound;

  // lang у <html> обязан совпадать с языком текста, иначе скринридер читает
  // русский по-румынски (axe: html-has-lang). Сам <html> отдаёт сервер, и
  // менять его атрибут — как раз работа для эффекта.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <main className="page flex min-h-dvh flex-col items-center justify-center gap-6 text-center">
      <p className="font-display text-[86px] leading-none" aria-hidden="true">
        404
      </p>
      <h1 className="font-display text-city">{t.title}</h1>
      <p className="font-body text-body text-charcoal">{t.text}</p>
      <Link
        href={localePath(locale, city ? paths.city(city) : paths.home())}
        className="btn-primary px-8"
      >
        {t.back}
      </Link>
    </main>
  );
}
