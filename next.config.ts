import type { NextConfig } from "next";
import { immutableCacheRules } from "./src/lib/cache-headers";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  images: {
    // Фото блюд отдаём готовыми WebP в трёх ширинах (scripts/prepare-images.py),
    // без оптимизатора Next — см. src/lib/image-loader.ts.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    deviceSizes: [400, 800, 1600],
    imageSizes: [],
  },
  // Не сообщать всем «X-Powered-By: Next.js» — лишняя подсказка атакующему
  poweredByHeader: false,
  // Защитные заголовки (CSP, HSTS и др.) на все адреса — src/lib/security-headers.ts,
  // плюс долгий кэш для неизменяемых файлов (src/lib/cache-headers.ts).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(process.env.NODE_ENV === "development"),
      },
      ...immutableCacheRules(),
    ];
  },
};

export default nextConfig;
