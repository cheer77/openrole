import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "src/generated/**", "node_modules/**"] },
  ...tseslint.configs.recommended,
);
