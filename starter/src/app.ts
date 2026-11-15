/*
FILE:      starter/src/app.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      createApp(): Hono routes GET /, POST /otp/send, POST /otp/verify on top of kwtsms-otp. Runtime neutral (Node, Bun, Workers).
WHY:       One app for every runtime; each entry file only supplies the socket address and starts the server.
*/

import { getClientIp, type Otp, type SendReason, type VerifyReason } from "kwtsms-otp";
import { Hono } from "hono";
import type { Lang } from "./i18n";
import { renderPage, type Mode } from "./ui";

/** Bindings an entry may pass to app.fetch(req, env): the TCP peer address (Node, Bun). */
export type AppEnv = { Bindings: { socketIp?: string } };

export interface AppOptions {
  otp: Otp;
  mode: Mode;
  appName?: string;
  /** Read x-forwarded-for (last entry) for the per-IP limit. Only behind a proxy you control. */
  trustProxy?: boolean;
  /** Cloudflare Workers: use cf-connecting-ip. */
  cloudflare?: boolean;
}

const STATUS: Record<SendReason | VerifyReason, 400 | 429> = {
  INVALID_PHONE: 400,
  COUNTRY_NOT_ALLOWED: 400,
  COOLDOWN: 429,
  LIMIT: 429,
  INVALID_OTP: 400,
  OTP_EXPIRED: 400,
  TOO_MANY_ATTEMPTS: 429,
};

const MAX_BODY = 2048;

export function createApp(opts: AppOptions) {
  const app = new Hono<AppEnv>();
  const appName = opts.appName ?? "App";

  async function readJson(req: Request): Promise<Record<string, unknown>> {
    const text = await req.text();
    if (text.length > MAX_BODY) return {};
    try {
      const v: unknown = JSON.parse(text);
      return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  app.get("/", (c) => {
    const lang: Lang = c.req.query("lang") === "ar" ? "ar" : "en";
    return c.html(renderPage(lang, opts.mode, appName));
  });

  app.post("/otp/send", async (c) => {
    const b = await readJson(c.req.raw);
    const ip = getClientIp(c.req.raw, { socketIp: c.env?.socketIp, trustProxy: opts.trustProxy, cloudflare: opts.cloudflare });
    const purpose = str(b.purpose);
    const r = await opts.otp.send({
      phone: str(b.phone),
      ip,
      lang: b.lang === "ar" ? "ar" : "en",
      purpose: purpose === "signup" || purpose === "phone" || purpose === "checkout" ? purpose : "login",
    });
    if (!r.ok) return c.json({ ok: false, error: r.reason }, STATUS[r.reason]);
    // generic answer: same body whether or not the SMS went out; the demo code only exists in demo mode
    return c.json(r.code ? { ok: true, demoCode: r.code } : { ok: true });
  });

  app.post("/otp/verify", async (c) => {
    const b = await readJson(c.req.raw);
    const r = await opts.otp.verify({ phone: str(b.phone), code: str(b.code) });
    if (!r.ok) return c.json({ ok: false, error: r.reason }, STATUS[r.reason]);
    return c.json({ ok: true, phone: r.phone });
  });

  app.onError((_err, c) => c.json({ ok: false, error: "GENERIC" }, 500));
  return app;
}
