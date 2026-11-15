/*
FILE:      packages/core/tests/otp.test.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      Core flow on the memory store and on the libsql store: hash, expiry, attempts, cooldown, caps, allowlist, fail closed, log hygiene.
WHY:       The behaviours in the design must hold on every store, with no network and no SMS.
*/
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOtp, MemoryStore, type OtpOptions, type OtpStore, type SmsSender } from "../src/index";
import { LibsqlStore } from "../src/libsql";
import { createKwtSender } from "../src/sender";

const PHONE = "96551234567";
const dir = mkdtempSync(join(tmpdir(), "kwtsms-otp-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function fake(result: { result: string; code?: string } = { result: "OK" }) {
  const sent: { mobile: string; message: string }[] = [];
  const sender: SmsSender = {
    send: async (mobile, message) => {
      sent.push({ mobile, message });
      return result;
    },
  };
  return { sender, sent };
}
const codeOf = (message: string) => /\d{6}/.exec(message)![0];

let n = 0;
const stores: [string, () => OtpStore][] = [
  ["memory", () => new MemoryStore({ silent: true })],
  ["libsql", () => new LibsqlStore({ url: `file:${join(dir, `t${n++}.db`)}` })],
];

describe.each(stores)("core on the %s store", (_name, mk) => {
  let t = 1_700_000_000_000;
  const now = () => t;
  beforeEach(() => {
    t = 1_700_000_000_000;
  });
  function setup(extra: Partial<OtpOptions> = {}, result?: { result: string; code?: string }) {
    const f = fake(result);
    const store = mk();
    return { ...f, store, otp: createOtp({ store, sender: f.sender, now, ...extra }) };
  }

  it("sends, then verifies once; the code is single use", async () => {
    const { otp, sent } = setup();
    expect(await otp.send({ phone: "51234567" })).toEqual({ ok: true, phone: PHONE });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.mobile).toBe(PHONE);
    const code = codeOf(sent[0]!.message);
    expect(await otp.verify({ phone: "+965 5123 4567", code })).toEqual({ ok: true, phone: PHONE });
    expect(await otp.verify({ phone: PHONE, code })).toEqual({ ok: false, reason: "OTP_EXPIRED" });
  });

  it("accepts Arabic digits in the code", async () => {
    const { otp, sent } = setup();
    await otp.send({ phone: PHONE });
    const code = codeOf(sent[0]!.message).replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));
    expect((await otp.verify({ phone: PHONE, code })).ok).toBe(true);
  });

  it("stores a hash and salt, never the code", async () => {
    const { otp, sent, store } = setup();
    await otp.send({ phone: PHONE });
    const code = codeOf(sent[0]!.message);
    const rec = (await store.getOtp(PHONE))!;
    expect(rec.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rec.salt).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(rec)).not.toContain(code);
    expect(rec.expiresAt).toBe(t + 300_000);
  });

  it("expires after 300 s", async () => {
    const { otp, sent } = setup();
    await otp.send({ phone: PHONE });
    t += 300_001;
    expect(await otp.verify({ phone: PHONE, code: codeOf(sent[0]!.message) })).toEqual({ ok: false, reason: "OTP_EXPIRED" });
  });

  it("allows 3 attempts: the 3rd wrong one burns the code, even a right code is refused after", async () => {
    const { otp, sent } = setup();
    await otp.send({ phone: PHONE });
    const code = codeOf(sent[0]!.message);
    const wrong = code === "000000" ? "111111" : "000000";
    expect(await otp.verify({ phone: PHONE, code: wrong })).toEqual({ ok: false, reason: "INVALID_OTP" });
    expect(await otp.verify({ phone: PHONE, code: wrong })).toEqual({ ok: false, reason: "INVALID_OTP" });
    expect(await otp.verify({ phone: PHONE, code: wrong })).toEqual({ ok: false, reason: "TOO_MANY_ATTEMPTS" });
    expect(await otp.verify({ phone: PHONE, code })).toEqual({ ok: false, reason: "OTP_EXPIRED" });
  });

  it("the right code still passes on the 3rd attempt", async () => {
    const { otp, sent } = setup();
    await otp.send({ phone: PHONE });
    const code = codeOf(sent[0]!.message);
    const wrong = code === "000000" ? "111111" : "000000";
    await otp.verify({ phone: PHONE, code: wrong });
    await otp.verify({ phone: PHONE, code: wrong });
    expect((await otp.verify({ phone: PHONE, code })).ok).toBe(true);
  });

  it("rejects a malformed code without a code being needed", async () => {
    const { otp } = setup();
    expect(await otp.verify({ phone: PHONE, code: "12" })).toEqual({ ok: false, reason: "INVALID_OTP" });
    expect(await otp.verify({ phone: "x", code: "123456" })).toEqual({ ok: false, reason: "INVALID_PHONE" });
  });

  it("cooldown 60 s per phone, then allowed again", async () => {
    const { otp, sent } = setup({ perPhonePerHour: 99 });
    expect((await otp.send({ phone: PHONE })).ok).toBe(true);
    expect(await otp.send({ phone: PHONE })).toEqual({ ok: false, reason: "COOLDOWN" });
    expect(sent).toHaveLength(1);
    t += 60_001;
    expect((await otp.send({ phone: PHONE })).ok).toBe(true);
    expect(sent).toHaveLength(2);
  });

  it("per-phone cap 5 per hour", async () => {
    const { otp } = setup();
    for (let i = 0; i < 5; i++) {
      expect((await otp.send({ phone: PHONE })).ok).toBe(true);
      t += 61_000;
    }
    expect(await otp.send({ phone: PHONE })).toEqual({ ok: false, reason: "LIMIT" });
  });

  it("per-IP cap 10 per hour across numbers; another IP is unaffected", async () => {
    const { otp } = setup();
    for (let i = 0; i < 10; i++) expect((await otp.send({ phone: `965500000${String(i).padStart(2, "0")}`, ip: "1.1.1.1" })).ok).toBe(true);
    expect(await otp.send({ phone: "96550000099", ip: "1.1.1.1" })).toEqual({ ok: false, reason: "LIMIT" });
    expect((await otp.send({ phone: "96550000098", ip: "2.2.2.2" })).ok).toBe(true);
  });

  it("global daily cap works as a kill switch (0 blocks everything)", async () => {
    const off = setup({ dailyCap: 0 });
    expect(await off.otp.send({ phone: PHONE })).toEqual({ ok: false, reason: "LIMIT" });
    expect(off.sent).toHaveLength(0);
    const two = setup({ dailyCap: 2, perIpPerHour: 99 });
    expect((await two.otp.send({ phone: "96550000001" })).ok).toBe(true);
    expect((await two.otp.send({ phone: "96550000002" })).ok).toBe(true);
    expect(await two.otp.send({ phone: "96550000003" })).toEqual({ ok: false, reason: "LIMIT" });
  });

  it("allowlist: a foreign or invalid number never reaches the sender or the store", async () => {
    const { otp, sent, store } = setup();
    expect(await otp.send({ phone: "+971501234567" })).toEqual({ ok: false, reason: "COUNTRY_NOT_ALLOWED" });
    expect(await otp.send({ phone: "abc" })).toEqual({ ok: false, reason: "INVALID_PHONE" });
    expect(sent).toHaveLength(0);
    expect(await store.getOtp("971501234567")).toBeUndefined();
    const gcc = setup({ allowedCountries: ["965", "971"] });
    expect((await gcc.otp.send({ phone: "+971501234567" })).ok).toBe(true);
  });

  it("a failing or throwing sender still answers ok (generic) and does not throw", async () => {
    const bad = setup({ logger: { warn() {}, error() {} } }, { result: "ERROR", code: "ERR028" });
    expect((await bad.otp.send({ phone: PHONE })).ok).toBe(true);
    const throwing = createOtp({ store: mk(), sender: { send: async () => { throw new Error("boom"); } }, now, logger: { warn() {}, error() {} } });
    expect((await throwing.send({ phone: PHONE })).ok).toBe(true);
  });

  it("exposes the code only with exposeCode (demo)", async () => {
    const d = setup({ exposeCode: true });
    const r = await d.otp.send({ phone: PHONE });
    expect(r.ok && r.code).toBe(codeOf(d.sent[0]!.message));
    const p = setup();
    expect(await p.otp.send({ phone: PHONE })).not.toHaveProperty("code");
  });
});

describe("fail closed", () => {
  const { sender } = fake();
  it("live without a persistent store refuses to start", () => {
    expect(() => createOtp({ store: new MemoryStore({ silent: true }), sender, live: true })).toThrow(/persistent store/);
  });
  it("live with a persistent store is fine; exposeCode with live is refused", () => {
    const store = new LibsqlStore({ url: `file:${join(dir, "live.db")}` });
    expect(() => createOtp({ store, sender, live: true })).not.toThrow();
    expect(() => createOtp({ store, sender, live: true, exposeCode: true })).toThrow(/demo only/);
  });
  it("live sender needs your own Sender ID and credentials", () => {
    expect(() => createKwtSender({ username: "u", password: "p", live: true })).toThrow(/senderId/);
    expect(() => createKwtSender({ username: "u", password: "p", live: true, senderId: "KWT-SMS" })).toThrow(/senderId/);
    expect(() => createKwtSender({ live: false })).toThrow(/username/);
    expect(() => createKwtSender({ username: "u", password: "p", live: true, senderId: "MyShop" })).not.toThrow();
  });
  it("the memory store warns once, loudly, unless silent", () => {
    const w = vi.spyOn(console, "warn").mockImplementation(() => {});
    new MemoryStore();
    expect(w).toHaveBeenCalledTimes(1);
    expect(String(w.mock.calls[0]![0])).toMatch(/demo only/);
    w.mockRestore();
  });
});

describe("log hygiene", () => {
  const spies: ReturnType<typeof vi.spyOn>[] = [];
  afterEach(() => {
    spies.forEach((s) => s.mockRestore());
    spies.length = 0;
  });
  it("no console output holds the code, the message text or the full number", async () => {
    for (const m of ["log", "info", "warn", "error", "debug"] as const) spies.push(vi.spyOn(console, m).mockImplementation(() => {}));
    const f = fake({ result: "ERROR", code: "ERR028" });
    const otp = createOtp({ store: new MemoryStore({ silent: true }), sender: f.sender });
    await otp.send({ phone: PHONE });
    const code = codeOf(f.sent[0]!.message);
    await otp.verify({ phone: PHONE, code: code === "000000" ? "111111" : "000000" });
    await otp.verify({ phone: PHONE, code });
    const all = spies.flatMap((s) => s.mock.calls.flat().map(String)).join("\n");
    expect(all).toContain("ERR028");
    expect(all).not.toContain(code);
    expect(all).not.toContain(PHONE);
    expect(all).not.toContain("your code");
  });
});
