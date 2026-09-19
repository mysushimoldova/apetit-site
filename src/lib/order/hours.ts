// Рабочие часы точки (SPEC §3 «Вне рабочих часов»): 08:30–23:00 по времени
// Кишинёва. Общий модуль: клиент — только показ (баннер, кнопка), решает
// сервер (src/server/orders). Время считается в Europe/Chisinau независимо от
// часового пояса сервера и телефона — летнее/зимнее время учитывает Intl.

export interface Hours {
  /** «08:30» */
  open: string;
  /** «23:00»; меньше open — работает через полночь */
  close: string;
}

export const ORDER_TIME_ZONE = "Europe/Chisinau";

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: ORDER_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Минуты от полуночи по Кишинёву. */
export function chisinauTime(date: Date): number {
  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? NaN);
  return get("hour") * 60 + get("minute");
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Принимает ли точка заказы в этот момент: [open, close). */
export function isOpenAt(date: Date, hours: Hours): boolean {
  const now = chisinauTime(date);
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  if (!Number.isFinite(now)) return false;
  return open <= close
    ? now >= open && now < close
    : now >= open || now < close;
}
