// Проверка секретных заголовков (webhook Telegram, будильник напоминаний).
// Сравнение за постоянное время; нет ожидаемого секрета → всегда отказ
// (fail-closed): без настроенного секрета маршрут закрыт.

const encoder = new TextEncoder();

export function secretMatches(
  received: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!received || !expected) return false;
  const a = encoder.encode(received);
  const b = encoder.encode(expected);
  // Разная длина — всё равно проходим весь цикл, чтобы время не выдавало длину
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    diff |= (a[i % a.length] ?? 0) ^ (b[i % b.length] ?? 0);
  }
  return diff === 0;
}
