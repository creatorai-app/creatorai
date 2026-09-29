import rootConfig from "../../eslint.config.js";

// Next 16 removed `next lint`, so the lint script now calls the ESLint CLI directly.
// The CLI resolves the nearest flat config, and the root one's ignore patterns are
// relative to the repo root, so `.next/` there does not match `apps/web/.next/`.
// Without this file ESLint walks the build output and reports thousands of problems
// in generated code. Rules stay in the root config; this only scopes the ignores.
export default [
  ...rootConfig,
  {
    ignores: [".next/**", "coverage/**", "playwright-report/**", "test-results/**", "next-env.d.ts"],
  },
];
