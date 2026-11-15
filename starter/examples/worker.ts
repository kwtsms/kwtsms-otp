/*
FILE:      starter/examples/worker.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      Cloudflare Workers entry: same app, KV store, cf-connecting-ip. Typecheck only in v0.1.
WHY:       Shows the Workers wiring; not run in CI (needs a Cloudflare account and the KV binding).
*/

import { createOtp, KvStore, type SmsSender } from "kwtsms-otp";
import { createKwtSender } from "kwtsms-otp/sender";
import { createApp } from "../src/app";

interface Env {
  OTP_KV: KVNamespace;
  KWTSMS_USERNAME: string;
  KWTSMS_PASSWORD: string;
  KWTSMS_SENDER_ID?: string;
  KWTSMS_LIVE?: string;
  APP_NAME?: string;
}

export default {
  fetch(req: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    const live = env.KWTSMS_LIVE === "1";
    const sender: SmsSender = createKwtSender({ username: env.KWTSMS_USERNAME, password: env.KWTSMS_PASSWORD, senderId: env.KWTSMS_SENDER_ID, live });
    const otp = createOtp({ store: new KvStore(env.OTP_KV), sender, live, appName: env.APP_NAME ?? "App" });
    const app = createApp({ otp, mode: live ? "live" : "test", appName: env.APP_NAME, cloudflare: true });
    return app.fetch(req, {}, ctx);
  },
};
