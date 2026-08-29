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
    // Vendored maplibre-gl worker bundle, copied verbatim from node_modules
    // (see src/components/MapView.tsx) — not our code, not meant to be linted.
    "public/maplibre-gl-worker.mjs",
    "public/maplibre-gl-shared.mjs",
  ]),
]);

export default eslintConfig;
