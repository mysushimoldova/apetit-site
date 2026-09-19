// Крошечный скрипт, который вставляется в начало <body> страницы «/».
// Он выполняется браузером ДО загрузки React: если город уже выбран —
// уходим на него сразу, и экран городов не успевает мигнуть.
// location.replace — чтобы кнопка «назад» не возвращала на «/».
// Список допустимых slug берётся из данных, поэтому чужое значение в
// хранилище никуда не уводит.
import { CITIES } from "@/data/points";
import { CITY_STORAGE_KEY } from "./city-storage";

export function buildCityRedirectScript(): string {
  const slugs = CITIES.map((c) => c.slug).join("|");
  return (
    "try{" +
    `var c=localStorage.getItem(${JSON.stringify(CITY_STORAGE_KEY)});` +
    `if(c&&/^(${slugs})$/.test(c))location.replace("/"+c)` +
    "}catch(e){}"
  );
}
