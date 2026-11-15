/*
FILE:      packages/core/src/store.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      OtpStore interface plus the memory store (demo only, warns once).
WHY:       Core talks to storage only through this small interface so SQL, KV and memory are interchangeable.
*/

export interface OtpRecord {
  /** hex SHA-256 of salt:phone:code, never the code itself */
  hash: string;
  salt: string;
  attempts: number;
  /** unix ms */
  expiresAt: number;
}

export interface OtpStore {
  /** "memory" is refused in live mode (fail closed): it is lost on restart and not shared between instances. */
  readonly kind: "memory" | "persistent";
  getOtp(phone: string): Promise<OtpRecord | undefined>;
  /** Replaces any earlier code for the phone. */
  setOtp(phone: string, rec: OtpRecord): Promise<void>;
  /** Atomic attempts + 1; returns the new count, or undefined when there is no live code. */
  bumpAttempts(phone: string, now: number): Promise<number | undefined>;
  /** True only for the caller that really removed the code (one-time use). */
  deleteOtp(phone: string): Promise<boolean>;
  /** Fixed-window counter: +1, returns the new count; the window starts at the first hit. */
  incr(key: string, windowSeconds: number, now: number): Promise<number>;
}

export class MemoryStore implements OtpStore {
  readonly kind = "memory" as const;
  private otps = new Map<string, OtpRecord>();
  private counters = new Map<string, { n: number; exp: number }>();

  constructor(opts: { silent?: boolean } = {}) {
    if (!opts.silent) {
      console.warn("[kwtsms-otp] MemoryStore: demo only. Codes and limits are lost on restart and not shared. Live mode refuses it.");
    }
  }

  async getOtp(phone: string) {
    return this.otps.get(phone);
  }
  async setOtp(phone: string, rec: OtpRecord) {
    this.otps.set(phone, { ...rec });
  }
  async bumpAttempts(phone: string, now: number) {
    const r = this.otps.get(phone);
    if (!r || r.expiresAt <= now) return undefined;
    r.attempts += 1;
    return r.attempts;
  }
  async deleteOtp(phone: string) {
    return this.otps.delete(phone);
  }
  async incr(key: string, windowSeconds: number, now: number) {
    const c = this.counters.get(key);
    if (!c || c.exp <= now) {
      this.counters.set(key, { n: 1, exp: now + windowSeconds * 1000 });
      this.sweep(now);
      return 1;
    }
    c.n += 1;
    return c.n;
  }
  /** Drop expired entries so a long-running demo does not grow without bound. */
  private sweep(now: number) {
    if (this.counters.size < 5000) return;
    for (const [k, c] of this.counters) if (c.exp <= now) this.counters.delete(k);
    for (const [k, r] of this.otps) if (r.expiresAt <= now) this.otps.delete(k);
  }
}
