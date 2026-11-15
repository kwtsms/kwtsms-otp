/*
FILE:      packages/core/src/kv.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      OtpStore for Cloudflare Workers KV (or any get/put/delete KV).
WHY:       Workers have no local disk; KV is the store there. Counters are best effort (KV is not atomic), documented in the README.
*/

import type { OtpRecord, OtpStore } from "./store";

/** The slice of Cloudflare KVNamespace that is used. */
export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export class KvStore implements OtpStore {
  readonly kind = "persistent" as const;
  constructor(private kv: KvLike, private prefix = "otp:") {}

  async getOtp(phone: string) {
    const v = await this.kv.get(`${this.prefix}c:${phone}`);
    return v ? (JSON.parse(v) as OtpRecord) : undefined;
  }
  async setOtp(phone: string, rec: OtpRecord) {
    // KV needs a TTL of at least 60 s
    await this.kv.put(`${this.prefix}c:${phone}`, JSON.stringify(rec), { expirationTtl: 600 });
  }
  async bumpAttempts(phone: string, now: number) {
    const r = await this.getOtp(phone);
    if (!r || r.expiresAt <= now) return undefined;
    r.attempts += 1;
    await this.setOtp(phone, r);
    return r.attempts;
  }
  async deleteOtp(phone: string) {
    const had = (await this.getOtp(phone)) !== undefined;
    await this.kv.delete(`${this.prefix}c:${phone}`);
    return had;
  }
  async incr(key: string, windowSeconds: number, now: number) {
    const k = `${this.prefix}n:${key}`;
    const raw = await this.kv.get(k);
    const cur = raw ? (JSON.parse(raw) as { n: number; exp: number }) : undefined;
    const next = !cur || cur.exp <= now ? { n: 1, exp: now + windowSeconds * 1000 } : { n: cur.n + 1, exp: cur.exp };
    await this.kv.put(k, JSON.stringify(next), { expirationTtl: Math.max(60, Math.ceil((next.exp - now) / 1000)) });
    return next.n;
  }
}
