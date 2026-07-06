import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import {configs as reactCompilerConfigs} from "eslint-plugin-react-compiler"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  reactCompilerConfigs.recommended,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".trigger/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
