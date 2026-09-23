import type { NextConfig } from "next";
import { immutableCacheRules } from "./src/lib/cache-headers";
import { securityHeaders } from "./src/lib/security-headers";

// Адрес, с которого Амян открывает dev-сервер с телефона в домашней сети
// (например 192.168.50.30). Лежит в .env.local, в git не попадает: у каждого
// свой. Переменной нет — список пустой, и с телефона dev-сервер не открыть.
const devOrigin = process.env.DEV_ORIGIN?.trim();

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigin ? [devOrigin] : [],

  // Своя страница «такого адреса нет» (src/app/global-not-found.tsx).
  // Нужна именно она: у сайта два корневых layout (ro и ru), и обычный
  // app/not-found.tsx Next в таком случае не показывает.
  experimental: {
    globalNotFound: true,
  },

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
