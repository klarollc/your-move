import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      ".restore/**",
      ".worktrees/**",
      ".cuckcode/**",
      "coverage/**",
      "**/dist/**",
      "**/*.tsbuildinfo",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{mjs,ts}"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
      },
    },
  },
  ...tseslint.configs.recommended,
);
