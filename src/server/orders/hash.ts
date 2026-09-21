// SHA-256 в hex через Web Crypto — есть и в Node, и в Cloudflare Workers,
// без node:crypto. В базе лежат хэши (dedup_hash, ip_hash), не сами данные.

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
