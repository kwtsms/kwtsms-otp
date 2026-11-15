/*
FILE:      packages/core/src/libsql.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      SQL OtpStore on @libsql/client (SQLite file, Turso or sqld): kwtsms-otp/libsql.
WHY:       One SQL layer that runs on Node and Bun; atomic counters through UPSERT ... RETURNING.
*/

import { createClient, type Client } from "@libsql/client";
import type { OtpRecord, OtpStore } from "./store";

export interface LibsqlStoreOptions {
  /** Existing client, or a url such as "file:./data/otp.db" or "libsql://...". */
  client?: Client;
  url?: string;
  authToken?: string;
}

export class LibsqlStore implements OtpStore {
  readonly kind = "persistent" as const;
  private db: Client;
  private ready: Promise<unknown> | undefined;

  constructor(opts: LibsqlStoreOptions) {
    if (opts.client) this.db = opts.client;
    else if (opts.url) this.db = createClient({ url: opts.url, authToken: opts.authToken });
    else throw new Error("[kwtsms-otp] LibsqlStore needs a client or a url");
  }

  /** Creates the two tables once; called before every query. */
  private init() {
    this.ready ??= this.db.batch(
      [
        "CREATE TABLE IF NOT EXISTS otp_codes (phone TEXT PRIMARY KEY, hash TEXT NOT NULL, salt TEXT NOT NULL, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL)",
        "CREATE TABLE IF NOT EXISTS otp_counters (k TEXT PRIMARY KEY, n INTEGER NOT NULL, exp INTEGER NOT NULL)",
      ],
      "write",
    );
    return this.ready;
  }

  async getOtp(phone: string): Promise<OtpRecord | undefined> {
    await this.init();
    const r = await this.db.execute({ sql: "SELECT hash, salt, attempts, expires_at FROM otp_codes WHERE phone = ?", args: [phone] });
    const row = r.rows[0];
    if (!row) return undefined;
    return { hash: String(row.hash), salt: String(row.salt), attempts: Number(row.attempts), expiresAt: Number(row.expires_at) };
  }

  async setOtp(phone: string, rec: OtpRecord) {
    await this.init();
    await this.db.execute({
      sql: "INSERT INTO otp_codes (phone, hash, salt, attempts, expires_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(phone) DO UPDATE SET hash = excluded.hash, salt = excluded.salt, attempts = excluded.attempts, expires_at = excluded.expires_at",
      args: [phone, rec.hash, rec.salt, rec.attempts, rec.expiresAt],
    });
  }

  async bumpAttempts(phone: string, now: number) {
    await this.init();
    const r = await this.db.execute({
      sql: "UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ? AND expires_at > ? RETURNING attempts",
      args: [phone, now],
    });
    return r.rows[0] ? Number(r.rows[0].attempts) : undefined;
  }

  async deleteOtp(phone: string) {
    await this.init();
    const r = await this.db.execute({ sql: "DELETE FROM otp_codes WHERE phone = ? RETURNING phone", args: [phone] });
    return r.rows.length > 0;
  }

  async incr(key: string, windowSeconds: number, now: number) {
    await this.init();
    const exp = now + windowSeconds * 1000;
    const r = await this.db.execute({
      sql: "INSERT INTO otp_counters (k, n, exp) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN exp <= ? THEN 1 ELSE n + 1 END, exp = CASE WHEN exp <= ? THEN ? ELSE exp END RETURNING n",
      args: [key, exp, now, now, exp],
    });
    return Number(r.rows[0]?.n ?? 1);
  }
}
