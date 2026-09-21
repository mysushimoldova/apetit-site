// Единственный клиент базы для приложения — только на сервере, с service
// role. Ключи — из .env.local (process.env), в код и в клиентский бандл не
// попадают. Создаётся лениво: при сборке проекта env не нужен.
import "server-only";
import { createServiceClient, type DbClient } from "./supabase";

let client: DbClient | null = null;

export function getServiceClient(): DbClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase: не заданы NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env.local)",
    );
  }
  client = createServiceClient(url, key);
  return client;
}
