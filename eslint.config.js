import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig } from "eslint/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = defineConfig([
  {
    ignores: [
      "**/node_modules/",
      "**/.next/",
      "**/dist/",
      "**/drizzle/",
      "**/*.log",
      "**/.DS_Store",
      "**/.env*",
      "**/package-lock.json",
      "**/pnpm-lock.yaml",
      "**/yarn.lock",
      "next-env.d.ts"
    ]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // TypeScript правила
      "@typescript-eslint/no-unused-vars": ["error", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-require-imports": "error",
      
      // Общие правила
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "eqeqeq": ["error", "always"],
      "curly": ["error", "all"],
      
      // React правила
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      
      // Импорты - временно отключаем строгие правила
      "import/order": "off"
    }
  }
]);

export default eslintConfig;