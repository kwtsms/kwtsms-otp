/*
FILE:      starter/tests/harness.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      E2E server: the real app, boot code and runtime serve helper with a fake SMS sender and a libsql file store, plus GET /__fake/last.
WHY:       Runs unchanged under Node (tsx) and Bun so the same HTTP test covers both runtimes without any SMS.
*/

import { Hono } from "hono";
import type { SmsSender } from "kwtsms-otp";
import { LibsqlStore } from "kwtsms-otp/libsql";
import type { AppEnv } from "../src/app";
import { bootFromEnv } from "../src/boot";
import { serveBun } from "../src/serve-bun";
import { serveNode } from "../src/serve-node";

const sent: { mobile: string; message: string }[] = [];
const sender: SmsSender = {
  send: async (mobile, message) => {
    sent.push({ mobile, message });
    return { result: "OK" };
  },
};

const g = globalThis as unknown as { process: { env: Record<string, string | undefined> }; Bun?: unknown };
const env = g.process.env;
const b = bootFromEnv({ ...env, PORT: "0" }, { sender, store: new LibsqlStore({ url: `file:${env.E2E_DB}` }) });

const outer = new Hono<AppEnv>();
outer.get("/__fake/last", (c) => c.json(sent.at(-1) ?? null));
outer.get("/__fake/count", (c) => c.json({ n: sent.length }));
outer.route("/", b.app);

const runtime = g.Bun ? "bun" : "node";
const port = g.Bun ? serveBun(outer, 0, "127.0.0.1").port : (await serveNode(outer, 0, "127.0.0.1")).port;
console.log(`LISTENING ${runtime} ${port}`);
