import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

/** ESLint 9 flat config: Next.js core-web-vitals + TypeScript rules. */
const config = [
  {
    ignores: [
      ".next/**",
      ".next-e2e/**",
      "node_modules/**",
      "docs-site/**",
      "docs/**",
      "data/**",
      "test-results/**",
      "playwright-report/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // `interface FooRepository extends Repository<Foo> {}` names a domain-specific
      // repository port on purpose; only flag empty interfaces that extend nothing.
      "@typescript-eslint/no-empty-object-type": ["error", { allowInterfaces: "with-single-extends" }],
      // Leading-underscore names are the codebase's convention for intentionally unused
      // bindings (e.g. destructuring a field out to drop it).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;
