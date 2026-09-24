// Проверка готовности к запуску: npm run launch:check
//
// Ничего не меняет — только смотрит и печатает список «сделано / не сделано».
// Значения ключей и секретов не печатаются никогда: только имена и ответ
// «есть / нет». Запускать можно сколько угодно раз.
//
// Что проверяется:
//   1. переменные окружения в .env.local (по именам);
//   2. SITE_URL: https, без слэша, совпадает с src/config/site.ts;
//   3. миграции 0001–0006 применены к базе;
//   4. запись settings → telegram_reminders (будильник напоминаний);
//   5. webhook бота стоит на боевой адрес и без ошибок;
//   6. матрица браузеров зелёная (последний прогон);
//   7. Lighthouse на мобильном: цели SPEC §9.5.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ENV_FILE = ".env.local";
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

/** Строки отчёта: {ok, title, note, section}; ok === null — это заголовок. */
const rows = [];
let section = "";

function head(title) {
  section = title;
  rows.push({ ok: null, title, note: "", section });
}

function check(ok, title, note = "") {
  rows.push({ ok, title, note, section });
  return ok;
}

// ============================================================
// 1. Переменные окружения
// ============================================================
head("1. Переменные окружения (.env.local)");

/** Что обязательно на боевом сайте. DEV_ORIGIN — только для разработки. */
const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ORDER_HASH_SECRET",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "REMINDERS_SECRET",
  "SITE_URL",
];

if (!existsSync(ENV_FILE)) {
  check(false, ENV_FILE, "файла нет — скопируйте .env.example и заполните");
}
for (const name of REQUIRED) {
  const value = process.env[name]?.trim();
  check(Boolean(value), name, value ? "" : "не задана");
}

// ============================================================
// 2. SITE_URL
// ============================================================
head("2. Боевой адрес (SITE_URL)");

const site = process.env.SITE_URL?.trim() ?? "";
check(
  site.startsWith("https://"),
  "начинается с https://",
  site ? "" : "SITE_URL не задана",
);
check(!site.endsWith("/"), "без слэша в конце");

const siteTs = readFileSync("src/config/site.ts", "utf8");
const inCode = siteTs.match(/SITE_URL\s*=\s*"([^"]+)"/)?.[1] ?? "";
check(
  Boolean(site) && site === inCode,
  "совпадает с src/config/site.ts",
  site && site !== inCode ? `в коде ${inCode}` : "",
);

// ============================================================
// 3. База: миграции
// ============================================================
head("3. Миграции применены (Supabase)");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Клиент service-role. Нет ключей — база не проверяется вовсе. */
const db =
  url && serviceKey
    ? createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

if (!db) {
  check(false, "подключение к базе", "нет URL или service-role ключа");
}

/** Есть ли такая колонка: 42703 — нет. */
async function hasColumn(table, column) {
  const { error } = await db.from(table).select(column).limit(1);
  if (!error) return true;
  if (error.code === "42703" || error.code === "PGRST204") return false;
  throw new Error(`${table}.${column}: ${error.code} ${error.message}`);
}

/** Есть ли таблица. */
async function hasTable(table) {
  const { error } = await db
    .from(table)
    .select("*", { head: true, count: "exact" });
  if (!error) return true;
  if (error.code === "42P01" || error.code === "PGRST205") return false;
  throw new Error(`${table}: ${error.code} ${error.message}`);
}

/** Принимает ли place_order() параметр p_is_test (миграция 0006).
 *  Проба ничего не записывает: с p_phone_limit = 0 функция сразу отвечает
 *  «лимит», до вставки дело не доходит. */
async function placeOrderTakesIsTest() {
  const { error } = await db.rpc("place_order", {
    p_point_id: "launch-check",
    p_city: "launch-check",
    p_lang: "ro",
    p_name: "launch-check",
    p_phone: "+37300000000",
    p_address: null,
    p_items: [],
    p_total: 0,
    p_ip_hash: null,
    p_dedup_hash: "launch-check",
    p_now: new Date().toISOString(),
    p_dedup_seconds: 1,
    p_phone_limit: 0,
    p_phone_window_seconds: 1,
    p_ip_limit: 0,
    p_ip_window_seconds: 1,
    p_is_test: true,
  });
  return !error;
}

if (db) {
  try {
    check(await hasTable("orders"), "0001: таблица orders");
    check(await hasTable("settings"), "0001: таблица settings");
    check(await hasTable("telegram_chats"), "0002: таблица telegram_chats");
    check(await hasTable("owner_chats"), "0002: таблица owner_chats");
    check(await hasTable("telegram_codes"), "0002: таблица telegram_codes");
    check(
      await hasColumn("orders", "reminders_sent"),
      "0002: orders.reminders_sent",
    );
    check(
      await hasColumn("orders", "owner_alerts_sent"),
      "0003: orders.owner_alerts_sent",
    );
    check(
      !(await hasColumn("orders", "alarm_stage")),
      "0004: orders.alarm_stage убрана",
    );
    check(
      await hasColumn("orders", "is_test"),
      "0005: orders.is_test",
      "Supabase → SQL Editor → supabase/migrations/0005_test_orders.sql → Run",
    );
    check(
      await placeOrderTakesIsTest(),
      "0006: place_order(p_is_test)",
      "Supabase → SQL Editor → supabase/migrations/0006_place_order_is_test.sql → Run",
    );
  } catch (error) {
    check(false, "опрос базы", String(error.message ?? error));
  }
}

// ============================================================
// 4. Будильник напоминаний
// ============================================================
head("4. Будильник напоминаний (settings → telegram_reminders)");

if (db) {
  const { data, error } = await db
    .from("settings")
    .select("value")
    .eq("key", "telegram_reminders")
    .maybeSingle();
  if (error) {
    check(false, "запись telegram_reminders", `${error.code} ${error.message}`);
  } else if (!data) {
    check(
      false,
      "запись telegram_reminders",
      "записи нет — напоминания не работают вовсе (см. docs/launch.md, шаг 5)",
    );
  } else {
    const value = data.value ?? {};
    const want = site ? `${site}/api/telegram/reminders` : "";
    check(typeof value.url === "string", "поле url заполнено");
    check(
      Boolean(want) && value.url === want,
      "url ведёт на боевой сайт",
      value.url === want ? "" : "адрес в базе не совпадает с SITE_URL",
    );
    const secret = process.env.REMINDERS_SECRET?.trim();
    check(
      Boolean(secret) && value.secret === secret,
      "секрет совпадает с REMINDERS_SECRET",
      secret ? "" : "REMINDERS_SECRET не задан",
    );
  }
}

// ============================================================
// 5. Webhook бота
// ============================================================
head("5. Webhook бота (Telegram)");

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  check(false, "getWebhookInfo", "TELEGRAM_BOT_TOKEN не задан");
} else {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/getWebhookInfo`,
    );
    const json = await response.json();
    if (!json.ok) {
      check(
        false,
        "getWebhookInfo",
        json.description ?? String(response.status),
      );
    } else {
      const info = json.result ?? {};
      const want = site ? `${site}/api/telegram/webhook` : "";
      check(
        Boolean(info.url),
        "webhook поставлен",
        info.url ? "" : "снят — запустите npm run telegram:setup",
      );
      check(
        Boolean(want) && info.url === want,
        "webhook ведёт на боевой сайт",
        info.url && info.url !== want ? "адрес не совпадает с SITE_URL" : "",
      );
      check(
        info.has_custom_certificate !== true,
        "без своего сертификата (нужен обычный HTTPS)",
      );
      check(
        !info.last_error_message,
        "последних ошибок нет",
        info.last_error_message ?? "",
      );
    }
  } catch (error) {
    check(false, "getWebhookInfo", String(error.message ?? error));
  }
}

// ============================================================
// 6. Матрица браузеров
// ============================================================
head("6. Матрица браузеров (npm run test:matrix)");

const LAST_RUN = join("test-results", ".last-run.json");
if (!existsSync(LAST_RUN)) {
  check(false, "последний прогон", "прогонов не было — npm run test:matrix");
} else {
  const run = JSON.parse(readFileSync(LAST_RUN, "utf8"));
  const when = statSync(LAST_RUN).mtime;
  const days = Math.floor((Date.now() - when.getTime()) / 86_400_000);
  check(
    run.status === "passed",
    "прогон зелёный",
    run.status === "passed"
      ? ""
      : `${run.status}, упало ${run.failedTests?.length ?? 0}`,
  );
  check(
    days <= 1,
    "прогон свежий",
    `последний — ${when.toLocaleString("ru-RU")}`,
  );
}

// ============================================================
// 7. Lighthouse
// ============================================================
head("7. Lighthouse на мобильном (цели SPEC §9.5)");

// Отчёты кладёт сам Lighthouse:
//   npx lighthouse@13.4.1 https://apetit.md/soroca --preset=mobile \
//     --output=json --output-path=docs/qa/lighthouse/soroca.json
// Папка в git не попадает (.gitignore): отчёты весят по мегабайту.
const REPORTS = join("docs", "qa", "lighthouse");
const files = existsSync(REPORTS)
  ? readdirSync(REPORTS).filter((f) => f.endsWith(".json"))
  : [];

if (files.length === 0) {
  check(
    false,
    "отчёты Lighthouse",
    `нет ни одного в ${REPORTS} — см. docs/launch.md, шаг 8`,
  );
} else {
  // Производительность — не ниже 85 на меню и 90 на остальных страницах;
  // доступность, практики и SEO — 100 (SPEC §9.5).
  for (const file of files) {
    const report = JSON.parse(readFileSync(join(REPORTS, file), "utf8"));
    const score = (id) =>
      Math.round((report.categories?.[id]?.score ?? 0) * 100);
    const menu = /soroca|sculeni|otaci|briceni/.test(file);
    const floor = menu ? 85 : 90;
    const performance = score("performance");
    check(
      performance >= floor,
      `${file}: производительность ≥ ${floor}`,
      `${performance}`,
    );
    for (const [id, label] of [
      ["accessibility", "доступность"],
      ["best-practices", "практики"],
      ["seo", "SEO"],
    ]) {
      const value = score(id);
      check(value === 100, `${file}: ${label} = 100`, `${value}`);
    }
  }
}

// ============================================================
// Вывод
// ============================================================
const OK = "✔";
const NO = "✖";
const lines = [];
let done = 0;
let total = 0;
const missing = [];

for (const row of rows) {
  if (row.ok === null) {
    lines.push("", row.title);
    continue;
  }
  total += 1;
  if (row.ok) done += 1;
  else
    missing.push(
      `${row.section} → ${row.title}${row.note ? ` (${row.note})` : ""}`,
    );
  lines.push(
    `  ${row.ok ? OK : NO} ${row.title}${row.note ? ` — ${row.note}` : ""}`,
  );
}

console.log(
  "Готовность к запуску apetit.md — только проверка, ничего не меняю",
);
console.log(lines.join("\n"));
console.log(`\nСделано ${done} из ${total}.`);
if (missing.length > 0) {
  console.log("\nНе сделано:");
  for (const item of missing) console.log(`  • ${item}`);
  console.log("\nПошаговый план запуска — docs/launch.md");
}
// Код возврата: 1, если что-то не готово — так проверку можно поставить
// в конвейер. Ничего при этом не менялось.
process.exit(missing.length > 0 ? 1 : 0);
