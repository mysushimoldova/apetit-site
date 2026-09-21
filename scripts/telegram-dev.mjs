// Локальная проверка бота: webhook снаружи недоступен, поэтому опрашиваем
// Telegram (getUpdates) и отдаём каждое событие в тот же маршрут
// /api/telegram/webhook на локальном dev-сервере с тем же секретом — код
// обработки один и тот же, что в бою. Раз в 60 с дёргаем будильник
// напоминаний. Запуск: npm run dev, затем npm run telegram:dev.
// Ключи — из .env.local; в вывод они не попадают.
process.loadEnvFile(".env.local");

const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const remindersSecret = process.env.REMINDERS_SECRET;
const local = process.env.LOCAL_URL ?? "http://localhost:3000";
const force = process.argv.includes("--force");

if (!token || !webhookSecret) {
  console.error(
    "Нужны TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET в .env.local",
  );
  process.exit(1);
}

async function tg(method, body = {}) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await r.json();
  if (!json.ok) throw new Error(`${method}: ${json.description ?? r.status}`);
  return json.result;
}

// Пока у бота стоит боевой webhook, getUpdates не работает — и снимать его
// из-за локальной проверки нельзя (сломает прод). Только с --force.
const info = await tg("getWebhookInfo");
if (info.url) {
  if (!force) {
    console.error(
      `У бота стоит webhook (${info.url}). Локальный опрос сломал бы его.\n` +
        "Если это точно нужно: npm run telegram:dev -- --force (webhook будет снят).",
    );
    process.exit(1);
  }
  await tg("deleteWebhook", { drop_pending_updates: false });
  console.log("webhook снят (--force); после проверки: npm run telegram:setup");
}

const me = await tg("getMe");
console.log(`Бот @${me.username}, события → ${local}/api/telegram/webhook`);

async function deliver(update) {
  const r = await fetch(`${local}/api/telegram/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Bot-Api-Secret-Token": webhookSecret,
    },
    body: JSON.stringify(update),
  });
  const kind = update.callback_query ? "callback" : "message";
  console.log(
    `${new Date().toISOString()} ${kind} #${update.update_id} → ${r.status} ${await r.text()}`,
  );
}

async function tickReminders() {
  if (!remindersSecret) return;
  try {
    const r = await fetch(`${local}/api/telegram/reminders`, {
      method: "POST",
      headers: { "X-Reminders-Secret": remindersSecret },
    });
    const body = await r.text();
    if (r.status !== 200 || !body.includes('"due":0')) {
      console.log(
        `${new Date().toISOString()} reminders → ${r.status} ${body}`,
      );
    }
  } catch (error) {
    console.log(`reminders: ${error.message}`);
  }
}

let offset = 0;
let running = true;
process.on("SIGINT", () => {
  running = false;
  console.log("\nстоп");
  process.exit(0);
});

const reminderTimer = setInterval(tickReminders, 60_000);
reminderTimer.unref();
await tickReminders();

while (running) {
  try {
    const updates = await tg("getUpdates", {
      offset,
      timeout: 30,
      allowed_updates: ["message", "callback_query"],
    });
    for (const update of updates) {
      offset = update.update_id + 1;
      await deliver(update);
    }
  } catch (error) {
    console.log(`опрос: ${error.message}; повтор через 3 с`);
    await new Promise((r) => setTimeout(r, 3000));
  }
}
