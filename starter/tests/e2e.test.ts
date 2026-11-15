/*
FILE:      starter/tests/e2e.test.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      HTTP E2E on Node and on Bun: pages, send, verify, attempts, cooldown, per-IP cap with a forged x-forwarded-for, no code in responses.
WHY:       The routes and the runtime entry code must work on every runtime we ship, hermetically (fake sender).
*/
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const harness = join(import.meta.dirname, "harness.ts");
const bunBin = [process.env.BUN_BIN, "bun", join(homedir(), ".bun/bin/bun")].find((b) => b && spawnSync(b, ["-v"]).status === 0);
// CI sets E2E_REQUIRE_BUN=1 so a missing Bun fails the run instead of skipping it
if (process.env.E2E_REQUIRE_BUN === "1" && !bunBin) throw new Error("E2E_REQUIRE_BUN=1 but bun was not found");

const runtimes: [string, string, string[]][] = [["node", process.execPath, ["--import", "tsx", harness]]];
if (bunBin) runtimes.push(["bun", bunBin, [harness]]);

describe.each(runtimes)("HTTP E2E on %s", (name, cmd, args) => {
  let child: ChildProcess;
  let base = "";
  let dir = "";
  let out = "";
  const post = async (path: string, body: unknown, headers: Record<string, string> = {}) => {
    const r = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
    return { status: r.status, json: (await r.json()) as Record<string, unknown> };
  };
  const last = async () => (await (await fetch(`${base}/__fake/last`)).json()) as { mobile: string; message: string } | null;
  const code = async () => /\d{6}/.exec((await last())!.message)![0];

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "kwtsms-e2e-"));
    child = spawn(cmd, args, { cwd: join(import.meta.dirname, ".."), env: { ...process.env, E2E_DB: join(dir, "e2e.db"), KWTSMS_LIVE: "", APP_NAME: "Shop" } });
    child.stderr!.on("data", (d: Buffer) => (out += d.toString()));
    base = await new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`no LISTENING line from ${name}: ${out}`)), 20000);
      child.stdout!.on("data", (d: Buffer) => {
        const m = /LISTENING (\w+) (\d+)/.exec(d.toString());
        if (m) {
          clearTimeout(t);
          expect(m[1]).toBe(name);
          resolve(`http://127.0.0.1:${m[2]}`);
        }
      });
      child.on("exit", (c) => reject(new Error(`harness exited ${c}: ${out}`)));
    });
  }, 30000);
  afterAll(() => {
    child?.kill();
    rmSync(dir, { recursive: true, force: true });
  });

  it("serves the page in English and Arabic (rtl)", async () => {
    const en = await (await fetch(base + "/")).text();
    expect(en).toContain('<html lang="en" dir="ltr">');
    expect(en).toContain("Test mode: SMS queued, not delivered");
    const ar = await (await fetch(base + "/?lang=ar")).text();
    expect(ar).toContain('<html lang="ar" dir="rtl">');
    expect(ar).toContain("رقم الجوال");
  });

  it("refuses bad and foreign numbers without sending", async () => {
    expect((await post("/otp/send", { phone: "abc" })).json).toEqual({ ok: false, error: "INVALID_PHONE" });
    const r = await post("/otp/send", { phone: "+971501234567" });
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ ok: false, error: "COUNTRY_NOT_ALLOWED" });
    expect(await last()).toBeNull();
  });

  it("send, wrong code, right code, reuse; the code never appears in a response", async () => {
    const s = await post("/otp/send", { phone: "50000001", lang: "ar", purpose: "checkout" });
    expect(s).toEqual({ status: 200, json: { ok: true } });
    const m = (await last())!;
    expect(m.mobile).toBe("96550000001");
    expect(m.message).toContain("Shop");
    const c = await code();
    expect(JSON.stringify(s.json)).not.toContain(c);
    const wrong = c === "000000" ? "111111" : "000000";
    expect((await post("/otp/verify", { phone: "50000001", code: wrong })).json).toEqual({ ok: false, error: "INVALID_OTP" });
    expect((await post("/otp/verify", { phone: "50000001", code: c })).json).toEqual({ ok: true, phone: "96550000001" });
    expect((await post("/otp/verify", { phone: "50000001", code: c })).json).toEqual({ ok: false, error: "OTP_EXPIRED" });
  });

  it("3 wrong attempts burn the code (429)", async () => {
    await post("/otp/send", { phone: "50000002" });
    const c = await code();
    const wrong = c === "000000" ? "111111" : "000000";
    await post("/otp/verify", { phone: "50000002", code: wrong });
    await post("/otp/verify", { phone: "50000002", code: wrong });
    const r = await post("/otp/verify", { phone: "50000002", code: wrong });
    expect(r).toEqual({ status: 429, json: { ok: false, error: "TOO_MANY_ATTEMPTS" } });
    expect((await post("/otp/verify", { phone: "50000002", code: c })).json).toEqual({ ok: false, error: "OTP_EXPIRED" });
  });

  it("cooldown returns 429 and sends nothing", async () => {
    await post("/otp/send", { phone: "50000003" });
    const before = (await (await fetch(`${base}/__fake/count`)).json()) as { n: number };
    const r = await post("/otp/send", { phone: "50000003" });
    expect(r).toEqual({ status: 429, json: { ok: false, error: "COOLDOWN" } });
    expect(((await (await fetch(`${base}/__fake/count`)).json()) as { n: number }).n).toBe(before.n);
  });

  it("per-IP cap uses the socket address: a forged x-forwarded-for does not dodge it", async () => {
    // earlier tests already used 4 sends from 127.0.0.1; the cap is 10 per hour
    let limited: unknown;
    for (let i = 10; i < 20 && !limited; i++) {
      const r = await post("/otp/send", { phone: `965500000${i}` }, { "x-forwarded-for": `9.9.9.${i}` });
      if (r.status === 429) limited = r.json;
    }
    expect(limited).toEqual({ ok: false, error: "LIMIT" });
  });

  it("malformed and oversized bodies answer a JSON error, not a crash", async () => {
    const r = await fetch(base + "/otp/send", { method: "POST", body: "{not json" });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, error: "INVALID_PHONE" });
    const big = await fetch(base + "/otp/verify", { method: "POST", body: "x".repeat(5000) });
    expect(big.status).toBe(400);
  });
});
