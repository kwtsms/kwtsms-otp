/*
FILE:      starter/src/boot.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      bootFromEnv(env): reads KWTSMS_* and DATABASE_URL and builds the app for Node and Bun in demo, test or live mode.
WHY:       Mode is decided in one place: no credentials = demo, credentials = test (test=1), KWTSMS_LIVE=1 = live (needs a Sender ID of your own and a database).
*/

import { createOtp, MemoryStore, type OtpStore, type SmsSender } from "kwtsms-otp";
import { LibsqlStore } from "kwtsms-otp/libsql";
import { createKwtSender } from "kwtsms-otp/sender";
import { createApp } from "./app";
import type { Mode } from "./ui";

export type Env = Record<string, string | undefined>;

export interface Boot {
  app: ReturnType<typeof createApp>;
  mode: Mode;
  port: number;
  host: string;
}

/** Demo sender: nothing leaves the machine. */
const demoSender: SmsSender = { send: async () => ({ result: "OK" }) };

export function bootFromEnv(env: Env, over: { sender?: SmsSender; store?: OtpStore } = {}): Boot {
  const hasCreds = Boolean(env.KWTSMS_USERNAME && env.KWTSMS_PASSWORD);
  const live = env.KWTSMS_LIVE === "1";
  const mode: Mode = live ? "live" : hasCreds || over.sender ? "test" : "demo";

  if (live && !env.DATABASE_URL && !over.store) {
    throw new Error("[kwtsms-otp] live mode needs DATABASE_URL (a file: or libsql: URL); refusing to start without a store");
  }
  const store: OtpStore = over.store ?? (env.DATABASE_URL ? new LibsqlStore({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN }) : new MemoryStore());
  const sender: SmsSender =
    over.sender ??
    (mode === "demo"
      ? demoSender
      : createKwtSender({ username: env.KWTSMS_USERNAME, password: env.KWTSMS_PASSWORD, senderId: env.KWTSMS_SENDER_ID, live }));

  const num = (v: string | undefined) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
  const appName = env.APP_NAME || "App";
  const otp = createOtp({
    store,
    sender,
    live,
    appName,
    exposeCode: mode === "demo",
    allowedCountries: env.ALLOWED_COUNTRIES ? env.ALLOWED_COUNTRIES.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    dailyCap: num(env.DAILY_CAP),
    perPhonePerHour: num(env.PER_PHONE_PER_HOUR),
    perIpPerHour: num(env.PER_IP_PER_HOUR),
    cooldownSeconds: num(env.COOLDOWN_SECONDS),
  });
  const app = createApp({ otp, mode, appName, trustProxy: env.TRUST_PROXY === "1" });
  return { app, mode, port: num(env.PORT) ?? 3000, host: env.HOST || "127.0.0.1" };
}
