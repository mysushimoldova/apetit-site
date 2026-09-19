import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Формат ESLint для Next.js 16 (flat config, без FlatCompat) —
// см. nextjs.org/docs/app/api-reference/config/eslint
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
    ".claude/**",
    "assets/**",
  ]),
]);

export default eslintConfig;
