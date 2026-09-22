// Напоминания о непринятом заказе (SPEC §4.3) — числа из
// src/config/alerts.json, минуты от created_at заказа:
//   reminderEvery / reminderMax — точке: «⏰ Comanda #N așteaptă — X minute»
//     каждые reminderEvery минут, не больше reminderMax раз
//     (2 × 15 = до 30 минут);
//   ownerAt / ownerRepeatEvery / ownerMax — владельцам: первое сообщение
//     через ownerAt минут, дальше каждые ownerRepeatEvery, всего ownerMax.
// Две дорожки независимы: в одну минуту могут совпасть (12-я — и напоминание,
// и первое сообщение владельцам). Файл проверяется схемой при загрузке:
// опечатка — ошибка сразу, не тишина.
import { z } from "@/lib/zod";
import raw from "./alerts.json";

const minutes = z.number().int().positive();

export const AlertsConfigSchema = z.object({
  reminderEvery: minutes,
  reminderMax: z.number().int().nonnegative(),
  ownerAt: minutes,
  ownerRepeatEvery: minutes,
  ownerMax: z.number().int().nonnegative(),
});
export type AlertsConfig = z.infer<typeof AlertsConfigSchema>;

export const alertsConfig: AlertsConfig = AlertsConfigSchema.parse(raw);
