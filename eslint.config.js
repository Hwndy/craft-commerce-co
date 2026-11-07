import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      // Nothing under assets/ is ever committed (scripts/encode-hls.sh and
      // scripts/seed-photos.ts write all of it locally — see .gitignore) —
      // ignore the whole tree rather than naming each output directory,
      // since a one-off directory name (e.g. a local re-encode attempt)
      // previously wasn't covered and its .ts segment files, parsed as
      // TypeScript, could crash ESLint with an out-of-memory error.
      "assets/**",
      "test-results",
      "playwright-report",
      "supabase/.temp",
      "supabase/.branches",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    ignores: ["scripts/**"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["scripts/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  }
);
