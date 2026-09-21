// Настройки движка для панели /dev/motion: прочитать файл и переписать его.
// Маршрут живёт ТОЛЬКО в разработке: в боевой сборке оба метода отвечают 404
// (проверено тестом e2e-prod/dev-routes.spec.ts).
//
// Безопасность (SPEC §9.4): пишем всегда в один и тот же файл проекта, путь
// из запроса не берём; тело проверяется схемой zod, лишние поля запрещены;
// запрос с чужой страницы отсекаем по заголовку Origin.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { motionConfigSchema } from "@/motion/config-schema";

// Нужен Node: маршрут пишет файл проекта
export const runtime = "nodejs";
// Ответ всегда считается заново, ничего не кэшируем
export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "src", "config", "motion.json");

const isDev = () => process.env.NODE_ENV === "development";

const notFound = () => new Response(null, { status: 404 });

export async function GET() {
  if (!isDev()) return notFound();
  const raw = await readFile(FILE, "utf8");
  const parsed = motionConfigSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    return Response.json(
      { error: "В src/config/motion.json неверные значения" },
      { status: 500 },
    );
  }
  return Response.json(parsed.data);
}

export async function POST(request: Request) {
  if (!isDev()) return notFound();

  // Браузер всегда ставит Origin на POST с другого сайта — такой запрос
  // писать файл не должен (запрос из терминала Origin не шлёт вовсе)
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Чужой источник" }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "Нужен JSON" }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Не разобрать JSON" }, { status: 400 });
  }

  const parsed = motionConfigSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Значения вне допустимых границ", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  await writeFile(FILE, `${JSON.stringify(parsed.data, null, 2)}\n`, "utf8");
  return Response.json(parsed.data);
}
