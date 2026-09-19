// Как fill() из messages.ts, но вместо {terms} можно подставить не строку,
// а элемент — например, ссылку. Порядок слов остаётся в переводе, а не в
// коде: в ru ссылки могут стоять в другом месте фразы, чем в ro.
import { Fragment, createElement, type ReactNode } from "react";

export function fillNodes(
  template: string,
  values: Record<string, ReactNode>,
): ReactNode[] {
  // split с группой: чётные — текст, нечётные — имена плейсхолдеров
  return template.split(/\{(\w+)\}/).map((part, i) => {
    if (i % 2 === 0) return part;
    const value = part in values ? values[part] : `{${part}}`;
    return createElement(Fragment, { key: i }, value);
  });
}
