// Телефон Молдовы (SPEC §3 шаг 5, CLAUDE.md): вводят 0XX XXX XXX или
// +373 XX XXX XXX, храним нормализованно: +373XXXXXXXX. Национальный номер —
// 8 цифр, первая 2–9 (06x/07x — мобильные, 02x — городские).

const NATIONAL = /^[2-9]\d{7}$/;
const FORMS = [
  /^\+373(\d{8})$/,
  /^00373(\d{8})$/,
  /^373(\d{8})$/,
  /^0(\d{8})$/,
];

/** «067 578 757» → «+37367578757»; не номер Молдовы → null. */
export function normalizePhone(input: string): string | null {
  const compact = input.replace(/[\s\-().]/g, "");
  for (const form of FORMS) {
    const national = form.exec(compact)?.[1];
    if (national && NATIONAL.test(national)) return `+373${national}`;
  }
  return null;
}

function group(digits: string, sizes: number[]): string {
  const out: string[] = [];
  let i = 0;
  for (const size of sizes) {
    if (i >= digits.length) break;
    out.push(digits.slice(i, i + size));
    i += size;
  }
  return out.join(" ");
}

/**
 * Маска при вводе: «067578757» → «067 578 757», «+37367578757» →
 * «+373 67 578 757». Лишние цифры и не-цифры отбрасываются.
 */
export function maskPhoneInput(raw: string): string {
  const plus = raw.trimStart().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (plus) {
    if (!digits.startsWith("373")) return `+${digits.slice(0, 12)}`;
    const rest = digits.slice(3, 11);
    return rest ? `+373 ${group(rest, [2, 3, 3])}` : "+373";
  }
  if (digits.startsWith("0") && !digits.startsWith("00")) {
    return group(digits.slice(0, 9), [3, 3, 3]);
  }
  return digits.slice(0, 13);
}

/** Номер точки «067578757» → «067 578 757». */
export function formatPhoneDisplay(phone: string): string {
  return maskPhoneInput(phone);
}

/** Для ссылки tel: — международный вид. */
export function phoneHref(phone: string): string {
  return `tel:${normalizePhone(phone) ?? phone}`;
}
