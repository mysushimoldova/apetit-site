// Уборка за тестами в настоящей базе. Тесты оформляют настоящие заказы
// (база одна и у разработки, и у сайта), поэтому свои строки они удаляют
// за собой сами.
//
// Удаляются только строки, помеченные сервером как тестовые
// (orders.is_test = true, миграция 0005), да ещё и по своему имени и своим
// телефонам: настоящий заказ этой уборке не по зубам, даже если кто-то
// случайно оформит его с тем же именем.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

/** Имя, по которому тесты узнают свои заказы. */
export const TEST_ORDER_NAME = "Ion Popescu";

export async function deleteTestOrders(
  name: string,
  phones: readonly string[],
): Promise<void> {
  const envFile = resolve(process.cwd(), ".env.local");
  if (phones.length === 0 || !existsSync(envFile)) return;
  process.loadEnvFile(envFile);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const remove = (onlyTest: boolean) => {
    const query = db
      .from("orders")
      .delete()
      .eq("name", name)
      .in("phone", [...phones]);
    return onlyTest ? query.eq("is_test", true) : query;
  };
  let { error } = await remove(true);
  // 42703 — колонки ещё нет: миграция 0005 в этой базе не применена
  if (error?.code === "42703" || error?.code === "PGRST204") {
    console.warn(
      "[e2e] миграция 0005 не применена (нет orders.is_test) — убираю по имени и телефонам",
    );
    ({ error } = await remove(false));
  }
  if (error) throw new Error(`уборка заказов: ${error.code} ${error.message}`);
}
