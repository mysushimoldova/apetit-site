import type { NextConfig } from "next";
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
  // Защитные заголовки (CSP, HSTS и др.) на все адреса — src/lib/security-headers.ts
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(process.env.NODE_ENV === "development"),
      },
    ];
  },
};

export default nextConfig;
