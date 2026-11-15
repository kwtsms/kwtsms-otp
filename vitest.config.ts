/*
FILE:      vitest.config.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      vitest config for the core unit tests and the starter HTTP E2E.
WHY:       One test run from the repo root.
*/
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["packages/core/tests/**/*.test.ts", "starter/tests/**/*.test.ts"], testTimeout: 30000 } });
