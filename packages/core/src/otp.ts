/*
FILE:      packages/core/src/otp.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      createOtp(): send(req) and verify(req) with hashed codes, expiry, 3 attempts, cooldown, hourly and daily caps, country allowlist.
WHY:       The whole OTP flow as two plain functions with injected store and sender, so Hono, Express and Fastify share one tested core.
*/

import { maskPhone } from "kwtsms";
import { toAsciiDigits } from "./digits";
import { buildPurposeMessage, PURPOSES, type Purpose } from "./messages";
import { normalizePhone } from "./phone";
import type { SmsSender } from "./sender";
import type { OtpStore } from "./store";
import type { Lang } from "./template";

export type SendReason = "INVALID_PHONE" | "COUNTRY_NOT_ALLOWED" | "COOLDOWN" | "LIMIT";
export type VerifyReason = "INVALID_PHONE" | "INVALID_OTP" | "OTP_EXPIRED" | "TOO_MANY_ATTEMPTS";

export interface SendRequest {
  phone: string;
  /** Caller IP from getClientIp(); counted against perIpPerHour. */
  ip?: string;
  lang?: Lang;
  purpose?: Purpose;
}
export type SendResult = { ok: true; phone: string; code?: string } | { ok: false; reason: SendReason };

export interface VerifyRequest {
  phone: string;
  code: string;
}
export type VerifyResult = { ok: true; phone: string } | { ok: false; reason: VerifyReason };

export interface Logger {
  warn(msg: string): void;
  error(msg: string): void;
}

export interface OtpOptions {
  store: OtpStore;
  sender: SmsSender;
  /** true = real delivery: a memory store is refused (fail closed). */
  live?: boolean;
  appName?: string;
  /** Default ["965"]. Empty list denies everything. */
  allowedCountries?: string[];
  codeLength?: number; // 6
  ttlSeconds?: number; // 300
  maxAttempts?: number; // 3
  cooldownSeconds?: number; // 60, 0 disables
  perPhonePerHour?: number; // 5
  perIpPerHour?: number; // 10
  /** Global sends per UTC day; 0 blocks every send (kill switch). Default 1000. */
  dailyCap?: number;
  /** Demo only: put the code in the send result so a screen can show it. Never with live. */
  exposeCode?: boolean;
  logger?: Logger;
  /** Test hook. */
  now?: () => number;
}

export interface Otp {
  send(req: SendRequest): Promise<SendResult>;
  verify(req: VerifyRequest): Promise<VerifyResult>;
}

const TAG = "[kwtsms-otp]";
const enc = new TextEncoder();

async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Uniform digits (rejection sampling, no modulo bias). */
export function generateCode(length: number): string {
  let out = "";
  const limit = 4294967296 - (4294967296 % 10);
  while (out.length < length) {
    const v = crypto.getRandomValues(new Uint32Array(1))[0]!;
    if (v >= limit) continue;
    out += String(v % 10);
  }
  return out;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function createOtp(o: OtpOptions): Otp {
  const live = o.live === true;
  if (live && o.store.kind === "memory") {
    throw new Error(`${TAG} live mode needs a persistent store (libsql or KV), not the memory store`);
  }
  if (live && o.exposeCode) throw new Error(`${TAG} exposeCode is for demo only, never with live`);

  const allowed = o.allowedCountries ?? ["965"];
  const len = o.codeLength ?? 6;
  const ttl = (o.ttlSeconds ?? 300) * 1000;
  const maxAttempts = o.maxAttempts ?? 3;
  const cooldown = o.cooldownSeconds ?? 60;
  const perPhone = o.perPhonePerHour ?? 5;
  const perIp = o.perIpPerHour ?? 10;
  const dailyCap = o.dailyCap ?? 1000;
  const appName = o.appName ?? "App";
  const log: Logger = o.logger ?? console;
  const now = o.now ?? Date.now;
  const store = o.store;

  return {
    async send(req) {
      const p = normalizePhone(req.phone, allowed);
      if (!p.ok) return { ok: false, reason: p.reason };
      const t = now();
      const phone = p.digits;

      if (cooldown > 0 && (await store.incr(`cd:${phone}`, cooldown, t)) > 1) return { ok: false, reason: "COOLDOWN" };
      const day = new Date(t).toISOString().slice(0, 10);
      if ((await store.incr(`day:${day}`, 86400, t)) > dailyCap) return { ok: false, reason: "LIMIT" };
      if ((await store.incr(`ip:${req.ip ?? "unknown"}`, 3600, t)) > perIp) return { ok: false, reason: "LIMIT" };
      if ((await store.incr(`ph:${phone}`, 3600, t)) > perPhone) return { ok: false, reason: "LIMIT" };

      const code = generateCode(len);
      const salt = randomHex(16);
      await store.setOtp(phone, { hash: await sha256Hex(`${salt}:${phone}:${code}`), salt, attempts: 0, expiresAt: t + ttl });

      const purpose = req.purpose && PURPOSES.includes(req.purpose) ? req.purpose : "login";
      try {
        const r = await o.sender.send(phone, buildPurposeMessage(req.lang === "ar" ? "ar" : "en", appName, code, purpose));
        if (r.result !== "OK") log.error(`${TAG} send failed ${r.code ?? "ERR"} to ${maskPhone(phone)}`);
      } catch {
        // generic answer either way: a failure must not reveal whether the number exists
        log.error(`${TAG} send failed (exception) to ${maskPhone(phone)}`);
      }
      return o.exposeCode ? { ok: true, phone, code } : { ok: true, phone };
    },

    async verify(req) {
      const p = normalizePhone(req.phone, allowed);
      if (!p.ok) return { ok: false, reason: "INVALID_PHONE" };
      const phone = p.digits;
      const code = toAsciiDigits(String(req.code ?? "")).trim();
      if (!new RegExp(`^\\d{${len}}$`).test(code)) return { ok: false, reason: "INVALID_OTP" };

      const t = now();
      const rec = await store.getOtp(phone);
      if (!rec || rec.expiresAt <= t) return { ok: false, reason: "OTP_EXPIRED" };

      const attempts = await store.bumpAttempts(phone, t);
      if (attempts === undefined) return { ok: false, reason: "OTP_EXPIRED" };
      if (attempts > maxAttempts) {
        await store.deleteOtp(phone);
        return { ok: false, reason: "TOO_MANY_ATTEMPTS" };
      }
      const good = safeEqual(rec.hash, await sha256Hex(`${rec.salt}:${phone}:${code}`));
      if (!good) {
        if (attempts >= maxAttempts) {
          await store.deleteOtp(phone);
          return { ok: false, reason: "TOO_MANY_ATTEMPTS" };
        }
        return { ok: false, reason: "INVALID_OTP" };
      }
      // one-time use: only the caller that removes the row passes
      if (!(await store.deleteOtp(phone))) return { ok: false, reason: "OTP_EXPIRED" };
      return { ok: true, phone };
    },
  };
}
