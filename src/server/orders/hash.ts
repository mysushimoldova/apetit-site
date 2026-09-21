// Хэши для базы через Web Crypto — есть и в Node, и в Cloudflare Workers,
// без node:crypto. В базе лежат хэши (dedup_hash, ip_hash), не сами данные.

const encoder = new TextEncoder();

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export async function sha256Hex(text: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

/** HMAC-SHA256: без секрета хэш IPv4 перебирается, с секретом — нет. */
export async function hmacSha256Hex(
  secret: string,
  text: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(text)));
}

let warned = false;

/**
 * Хэш IP для лимита: HMAC с ORDER_HASH_SECRET. Секрета нет — сервер не падает,
 * берёт простой SHA-256 и один раз пишет предупреждение в лог.
 */
export async function ipHash(
  ip: string,
  secret: string | undefined,
  warn: (message: string) => void,
): Promise<string> {
  if (secret) return hmacSha256Hex(secret, ip);
  if (!warned) {
    warned = true;
    warn(
      "ORDER_HASH_SECRET не задан: ip_hash считается без секрета (SHA-256). Добавь секрет в .env.local",
    );
  }
  return sha256Hex(ip);
}
