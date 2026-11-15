# Changelog

## [0.1.0] - 2026-11-16

- First release: kwtSMS SMS one-time codes for Node, Bun and Cloudflare Workers. Core `createOtp()` with `send` and `verify`: 6-digit codes stored as a salted SHA-256 hash, 300 second expiry, 3 attempts, resend cooldown, per-number, per-IP and daily limits, country allowlist (Kuwait by default). Stores: memory (demo only), SQL through libSQL (SQLite file or Turso) and Workers KV. Test mode by default; live mode needs your own Sender ID and a persistent store. Includes a Hono starter app with English and Arabic screens.
