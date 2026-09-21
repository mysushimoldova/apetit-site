// Ставит боевой webhook бота: SITE_URL/api/telegram/webhook с секретом
// TELEGRAM_WEBHOOK_SECRET (Telegram присылает его заголовком). Запускать
// после публикации сайта: npm run telegram:setup. Ключи — из .env.local.
process.loadEnvFile(".env.local");

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const site = process.env.SITE_URL;

if (!token || !secret || !site) {
  console.error(
    "Нужны TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET и SITE_URL в .env.local",
  );
  process.exit(1);
}
if (!/^https:\/\//.test(site)) {
  console.error(
    "SITE_URL должен начинаться с https:// (Telegram шлёт только на HTTPS)",
  );
  process.exit(1);
}
if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
  console.error(
    "TELEGRAM_WEBHOOK_SECRET: только A-Z a-z 0-9 _ - (до 256 знаков)",
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

const url = `${site.replace(/\/$/, "")}/api/telegram/webhook`;
await tg("setWebhook", {
  url,
  secret_token: secret,
  allowed_updates: ["message", "callback_query"],
  drop_pending_updates: true,
});
const info = await tg("getWebhookInfo");
console.log(`webhook: ${info.url} (pending: ${info.pending_update_count})`);
if (info.last_error_message)
  console.log(`последняя ошибка: ${info.last_error_message}`);
