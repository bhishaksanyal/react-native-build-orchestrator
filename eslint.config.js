import tseslint from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    ignores: ["dist/**", "coverage/**", "rnbuild.env.ts", "**/*.test.ts"]
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser,
      ecmaVersion: "latest",
      sourceType: "module"
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "warn"
    }
  }
];
