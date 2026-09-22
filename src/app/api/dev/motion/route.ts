// Настройки движка для панели /dev/motion: прочитать файл и переписать его.
// Маршрут живёт ТОЛЬКО в разработке: в боевой сборке оба метода отвечают 404
// (проверено тестом e2e-prod/dev-routes.spec.ts).
//
// Безопасность (SPEC §9.4): пишем всегда в один и тот же файл проекта, путь
// из запроса не берём; тело проверяется схемой zod, лишние поля запрещены;
// запрос с чужой страницы отсекаем по заголовку Origin.
//
// Запись — через временный файл с переименованием (writeFileAtomic): две
// одновременные записи больше не оставляют половинчатый motion.json.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { writeFileAtomic } from "@/lib/write-file-atomic";
import { motionConfigSchema } from "@/motion/config-schema";

// Нужен Node: маршрут пишет файл проекта
export const runtime = "nodejs";
// Ответ всегда считается заново, ничего не кэшируем
export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "src", "config", "motion.json");

const isDev = () => process.env.NODE_ENV === "development";

const notFound = () => new Response(null, { status: 404 });

/** Хост из заголовка Origin («http://localhost:3000» → «localhost:3000»).
 *  Неразбираемый Origin — точно не наш. */
function originHost(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

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
  // писать файл не должен (запрос из терминала Origin не шлёт вовсе).
  // Сравниваем с заголовком Host — адресом, на который браузер и постучался.
  // (request.url в dev-сервере Next 16 показывает 0.0.0.0:3000, на что бы
  // браузер ни открыл страницу, поэтому сравнивать с ним нельзя.)
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && (!host || originHost(origin) !== host)) {
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

  await writeFileAtomic(FILE, `${JSON.stringify(parsed.data, null, 2)}\n`);
  return Response.json(parsed.data);
}
