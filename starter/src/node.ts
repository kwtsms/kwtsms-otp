/*
FILE:      starter/src/node.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      Node entry: npm start. Reads the environment, boots, listens.
WHY:       The one file to run on Node 20, 22, 24.
*/

import { mkdirSync } from "node:fs";
import { bootFromEnv } from "./boot";
import { serveNode } from "./serve-node";

if (process.env.DATABASE_URL?.startsWith("file:./data/")) mkdirSync("data", { recursive: true });
const b = bootFromEnv(process.env);
const s = await serveNode(b.app, b.port, b.host);
console.log(`[kwtsms-otp] ${b.mode} mode on http://${b.host}:${s.port}`);
