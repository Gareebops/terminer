import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude worktree-ovi (paralelne sesije) - tuđi radni prostor sa
    // sopstvenim .next buildom, ne lintuje se odavde
    ".claude/**",
    // Mobile app ima svoj lint setup (expo); ovaj config je za web
    "mobile/**",
  ]),
]);

export default eslintConfig;
