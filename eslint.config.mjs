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
    // Third-party design-reference bundle, not our source.
    "design_handoff_hostel_erp/**",
  ]),
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/data/mock/*", "@/lib/data/mock/*"],
              message:
                "Import from '@/lib/data' (the `repo` export) instead of reaching into the mock backend directly — this is what keeps a future real backend swap mechanical.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
