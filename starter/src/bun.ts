/*
FILE:      starter/src/bun.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      Bun entry: bun src/bun.ts. Reads the environment, boots, listens.
WHY:       The one file to run on Bun.
*/

import { mkdirSync } from "node:fs";
import { bootFromEnv } from "./boot";
import { serveBun } from "./serve-bun";

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
if (env.DATABASE_URL?.startsWith("file:./data/")) mkdirSync("data", { recursive: true });
const b = bootFromEnv(env);
const s = serveBun(b.app, b.port, b.host);
console.log(`[kwtsms-otp] ${b.mode} mode on http://${b.host}:${s.port}`);
