/*
FILE:      starter/examples/express.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      Express and Fastify style use of the core without Hono: two handlers around createOtp.
WHY:       Shows the handler contract send(req)->{ok}, verify(req)->{ok, phone} in an existing Node app.
*/

// Minimal structural types so this file typechecks without installing express.
import { createOtp, getClientIp, MemoryStore, type SmsSender } from "kwtsms-otp";

interface Req {
  body: { phone?: string; code?: string };
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
}
interface Res {
  status(n: number): Res;
  json(v: unknown): void;
}

const sender: SmsSender = { send: async () => ({ result: "OK" }) }; // use createKwtSender() from "kwtsms-otp/sender"
const otp = createOtp({ store: new MemoryStore(), sender }); // use LibsqlStore from "kwtsms-otp/libsql" in production

export async function postSend(req: Req, res: Res) {
  const h = { get: (n: string) => String(req.headers[n.toLowerCase()] ?? "") || null };
  const r = await otp.send({ phone: req.body.phone ?? "", ip: getClientIp({ headers: h }, { socketIp: req.socket.remoteAddress }) });
  res.status(r.ok ? 200 : 429).json(r.ok ? { ok: true } : { ok: false, error: r.reason });
}

export async function postVerify(req: Req, res: Res) {
  const r = await otp.verify({ phone: req.body.phone ?? "", code: req.body.code ?? "" });
  res.status(r.ok ? 200 : 400).json(r.ok ? { ok: true, phone: r.phone } : { ok: false, error: r.reason });
}
// app.post("/otp/send", postSend); app.post("/otp/verify", postVerify);
