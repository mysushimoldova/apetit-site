import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Фото блюд отдаём готовыми WebP в трёх ширинах (scripts/prepare-images.py),
    // без оптимизатора Next — см. src/lib/image-loader.ts.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    deviceSizes: [400, 800, 1600],
    imageSizes: [],
  },
};

export default nextConfig;
