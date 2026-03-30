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
    "public/websdk.client.bundle.min.js",
    "public/websdk.compat.js",
    "public/dp.core.bundle.js",
    "public/dp.devices.bundle.js",
  ]),
]);

export default eslintConfig;
