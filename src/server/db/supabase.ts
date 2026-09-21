// Сборка серверного клиента Supabase (service role — обходит RLS). Файл без
// server-only, чтобы интеграционный тест мог собрать клиент из .env.local;
// ключи сюда передаёт client.ts (приложение) или тест.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type DbClient = SupabaseClient<Database>;

export function createServiceClient(
  url: string,
  serviceRoleKey: string,
): DbClient {
  return createClient<Database>(url, serviceRoleKey, {
    // Сервер: ни сессий, ни localStorage, ни разбора адреса
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
