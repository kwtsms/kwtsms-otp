# kwtsms-otp

SMS one-time codes (OTP) through [kwtSMS](https://www.kwtsms.com), the Kuwaiti SMS gateway. Two functions, `send` and `verify`, with hashed codes, 3 attempts, resend cooldown, rate limits and a country allowlist. The core uses Web APIs only, so it runs on Node 18+, Bun and Cloudflare Workers. Test mode by default.

Full starter app (Hono, English and Arabic screens), use cases and deploy notes: https://github.com/kwtsms/kwtsms-otp

## Install

```bash
npm install kwtsms-otp
npm install @libsql/client   # only for the SQL store
```

## Use

```ts
import { createOtp, getClientIp } from "kwtsms-otp";
import { LibsqlStore } from "kwtsms-otp/libsql";
import { createKwtSender } from "kwtsms-otp/sender";

const live = process.env.KWTSMS_LIVE === "1";
const otp = createOtp({
  store: new LibsqlStore({ url: "file:./data/otp.db" }),
  sender: createKwtSender({
    username: process.env.KWTSMS_USERNAME,
    password: process.env.KWTSMS_PASSWORD,
    senderId: process.env.KWTSMS_SENDER_ID, // your own Sender ID, needed for live
    live,
  }),
  live,
  appName: "Shop", // ASCII, cut to 16 characters
});

const sent = await otp.send({ phone: "965XXXXXXXX", ip: getClientIp(request, { socketIp }), lang: "en", purpose: "login" });
// { ok: true, phone } or { ok: false, reason: "INVALID_PHONE" | "COUNTRY_NOT_ALLOWED" | "COOLDOWN" | "LIMIT" }

const checked = await otp.verify({ phone: "965XXXXXXXX", code: "123456" });
// { ok: true, phone } or { ok: false, reason: "INVALID_PHONE" | "INVALID_OTP" | "OTP_EXPIRED" | "TOO_MANY_ATTEMPTS" }
```

`send` answers the same whether or not the SMS went out: a delivery failure is logged as an `ERR` code and a masked number, never shown to the caller. A successful `verify` is the only moment to start a session; sessions are your app's job.

## Defaults

| Option | Default |
| --- | --- |
| `codeLength` | 6 |
| `ttlSeconds` | 300 |
| `maxAttempts` | 3 (the 3rd wrong one burns the code) |
| `cooldownSeconds` | 60 per number (0 disables) |
| `perPhonePerHour` | 5 |
| `perIpPerHour` | 10 |
| `dailyCap` | 1000 sends per UTC day; 0 blocks every send (kill switch) |
| `allowedCountries` | `["965"]`; an empty list denies everything |
| `purpose` | `login`, `signup`, `phone` or `checkout`: a short fixed text per use case, one SMS part |

## Stores

- `MemoryStore`: demo only. Warns on creation. `createOtp({ live: true })` throws with it (fail closed).
- `LibsqlStore` (`kwtsms-otp/libsql`): SQLite file, Turso or sqld through `@libsql/client`. Counters are atomic.
- `KvStore`: Cloudflare Workers KV. KV is not atomic, so limits are best effort there.
- Your own: implement the 5 methods of `OtpStore`.

## Client IP

`getClientIp(request, { socketIp, trustProxy, cloudflare })`. `x-forwarded-for` is read only with `trustProxy: true` and then only its last entry (the one your own proxy appended). On Workers pass `cloudflare: true` for `cf-connecting-ip`. Otherwise the socket address is used.

## Live mode

`createKwtSender({ live: true })` throws without credentials or with the shared Sender ID `KWT-SMS`. Live also needs a persistent store. Cost: 1 credit per SMS part; the English text is one part (160 characters), the Arabic text is one part (70).

## License

MIT. Support: https://www.kwtsms.com/support.html
