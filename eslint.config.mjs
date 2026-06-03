import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

// Single flat config for the whole monorepo. Run from the root via `pnpm lint`.
// Uses the non-type-checked recommended set so no tsconfig project wiring is
// needed; tighten to recommendedTypeChecked later if you want type-aware rules.
export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node-side code: backend + e2e tooling
    files: ["backend/**/*.ts", "e2e/**/*.ts"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Browser-side code: the React frontend.
    // To add React-hooks linting later: `pnpm add -Dw eslint-plugin-react-hooks`,
    // then register it as a plugin here and enable its rules.
    files: ["frontend/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
  },
);
