/*
FILE:      packages/core/tests/ip.test.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      getClientIp with and without trustProxy, and on Cloudflare.
WHY:       A forged x-forwarded-for must not let a bot dodge the per-IP cap.
*/
import { describe, expect, it } from "vitest";
import { getClientIp } from "../src/index";

const req = (h: Record<string, string>) => ({ headers: new Headers(h) });

describe("getClientIp", () => {
  it("ignores x-forwarded-for without trustProxy", () => {
    expect(getClientIp(req({ "x-forwarded-for": "1.2.3.4" }), { socketIp: "10.0.0.9" })).toBe("10.0.0.9");
  });
  it("uses the last x-forwarded-for entry with trustProxy (the proxy's own, not the client's)", () => {
    expect(getClientIp(req({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" }), { socketIp: "10.0.0.9", trustProxy: true })).toBe("1.2.3.4");
  });
  it("falls back to the socket when trustProxy has no header or a bad value", () => {
    expect(getClientIp(req({}), { socketIp: "10.0.0.9", trustProxy: true })).toBe("10.0.0.9");
    expect(getClientIp(req({ "x-forwarded-for": "<script>" }), { socketIp: "10.0.0.9", trustProxy: true })).toBe("10.0.0.9");
  });
  it("uses cf-connecting-ip only on Cloudflare", () => {
    expect(getClientIp(req({ "cf-connecting-ip": "9.9.9.9" }), { cloudflare: true })).toBe("9.9.9.9");
    expect(getClientIp(req({ "cf-connecting-ip": "9.9.9.9" }), { socketIp: "10.0.0.9" })).toBe("10.0.0.9");
  });
  it("is unknown with nothing to go on", () => {
    expect(getClientIp(req({}))).toBe("unknown");
  });
});
