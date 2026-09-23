// Крошечный скрипт, который вставляется в оформление заказа и выполняется
// браузером ДО первой отрисовки. Он смотрит на часы устройства и, если точка
// сейчас закрыта, ставит на <body> признак data-closed.
//
// Зачем. Баннер «Primim comenzi 08:30–23:00» лежит в разметке всегда, а
// показывает его CSS по этому признаку (globals.css → .closed-slot). Раньше
// баннер рисовал React после гидратации: страница успевала показаться без
// него, а потом заголовок, вся форма и подвал уезжали вниз на 62 пикселя.
// Такой прыжок видно глазами, и он же — сдвиг вёрстки (CLS).
//
// Почему нельзя решить на сервере: страница оформления собирается заранее
// (generateStaticParams), одна и та же разметка отдаётся и в полдень, и
// ночью. Часы знает только браузер.
//
// Решение о приёме заказа этот скрипт не принимает — только показ. Принимает
// сервер (src/server/orders), и он же может ответить «закрыто», даже если
// часы на телефоне врут.
import { ORDER_TIME_ZONE, type Hours } from "./hours";

/** Признак на <body>: «сейчас закрыто». */
export const CLOSED_ATTRIBUTE = "data-closed";

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Текст скрипта. Логика повторяет isOpenAt() из hours.ts: минуты от полуночи
 * по Кишинёву, промежуток [open, close), close меньше open — работа через
 * полночь. На эту пару есть общий тест (closed-script.test.ts).
 */
export function buildClosedScript(hours: Hours): string {
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  // В скрипт уходят только два числа, и это единственное, что в нём меняется.
  // Часы приходят из наших данных (src/data/points.ts), снаружи их задать
  // нельзя, но проверку оставляем: испорченное значение даст пустой скрипт,
  // а не строку, которую браузер попробует выполнить как код.
  const sane = (value: number) =>
    Number.isInteger(value) && value >= 0 && value < 24 * 60;
  if (!sane(open) || !sane(close)) return "";
  const zone = JSON.stringify(ORDER_TIME_ZONE);
  const attr = JSON.stringify(CLOSED_ATTRIBUTE);
  const inRange =
    open <= close ? `n>=${open}&&n<${close}` : `n>=${open}||n<${close}`;
  return (
    "try{" +
    `var p=new Intl.DateTimeFormat("en-GB",{timeZone:${zone},hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());` +
    "var g=function(t){for(var i=0;i<p.length;i++)if(p[i].type===t)return Number(p[i].value);return NaN};" +
    'var n=g("hour")*60+g("minute");' +
    `if(!(${inRange}))document.body.setAttribute(${attr},"")` +
    "}catch(e){}"
  );
}
