// Крошечный скрипт, который вставляется в начало <body> экрана городов
// («/» и «/ru»). Он выполняется браузером ДО загрузки React: если город уже
// выбран — уходим на него сразу, и экран городов не успевает мигнуть.
// location.replace — чтобы кнопка «назад» не возвращала на «/».
//
// Язык: на «/ru» — всегда русский. На «/» — тот, что посетитель выбрал сам
// переключателем (apetit.lang), иначе язык города (Otaci → ru, SPEC §7).
// Списки допустимых значений берутся из данных, поэтому чужое значение в
// хранилище никуда не уводит.
import { CITIES, type Locale } from "@/data/points";
import { RU_PREFIX } from "@/i18n/routes";
import { CITY_STORAGE_KEY } from "./city-storage";
import { LANG_STORAGE_KEY } from "./lang-storage";

export function buildCityRedirectScript(locale: Locale): string {
  const ruByDefault = CITIES.filter((c) => c.locale === "ru").map(
    (c) => c.slug,
  );
  const slugs = CITIES.map((c) => c.slug).join("|");
  const ruPrefix = JSON.stringify(RU_PREFIX);
  const langExpr =
    locale === "ru"
      ? "true"
      : `l==="ru"||(l!=="ro"&&${JSON.stringify(ruByDefault)}.indexOf(c)>=0)`;
  return (
    "try{" +
    `var c=localStorage.getItem(${JSON.stringify(CITY_STORAGE_KEY)});` +
    `var l=localStorage.getItem(${JSON.stringify(LANG_STORAGE_KEY)});` +
    `if(c&&/^(${slugs})$/.test(c))location.replace((${langExpr}?${ruPrefix}:"")+"/"+c)` +
    "}catch(e){}"
  );
}
