/*
FILE:      eslint.config.mjs
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      ESLint flat config (typescript-eslint recommended).
WHY:       Same lint gate as kwtsms-better-auth.
*/
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**"] },
  ...tseslint.configs.recommended,
);
