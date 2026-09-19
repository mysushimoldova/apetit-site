import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Тесты Playwright живут в e2e/ и запускаются отдельно (npm run test:e2e)
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
  },
});
