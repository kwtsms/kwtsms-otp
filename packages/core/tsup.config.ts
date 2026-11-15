/*
FILE:      packages/core/tsup.config.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      tsup build: ESM + CJS + .d.ts for index, sender and libsql.
WHY:       One package that works from import and require, with types; libsql stays external.
*/
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/sender.ts", "src/libsql.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  target: "node18",
  external: ["@libsql/client", "kwtsms"],
});
