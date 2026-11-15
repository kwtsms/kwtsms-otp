/*
FILE:      packages/core/tests/phone.test.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      Phone normalization table and messages length (same table as kwtsms-better-auth).
WHY:       Every integration must treat the same input the same way; one SMS part per code.
*/
import { describe, expect, it } from "vitest";
import { buildPurposeMessage, normalizePhone, PURPOSES } from "../src/index";

describe("normalizePhone", () => {
  it.each([
    ["96551234567", "96551234567"],
    ["+965 5123 4567", "96551234567"],
    ["0096551234567", "96551234567"],
    ["51234567", "96551234567"],
    ["٥١٢٣٤٥٦٧", "96551234567"],
    ["۵۱۲۳۴۵۶۷", "96551234567"],
    ["+٩٦٥٥١٢٣٤٥٦٧", "96551234567"],
  ])("%s -> %s", (input, digits) => {
    const r = normalizePhone(input, ["965"]);
    expect(r).toEqual({ ok: true, digits, country: "965" });
  });

  it("refuses another country and garbage", () => {
    expect(normalizePhone("+971501234567", ["965"])).toEqual({ ok: false, reason: "COUNTRY_NOT_ALLOWED" });
    expect(normalizePhone("abc", ["965"])).toEqual({ ok: false, reason: "INVALID_PHONE" });
    expect(normalizePhone("", ["965"])).toEqual({ ok: false, reason: "INVALID_PHONE" });
    expect(normalizePhone("51234567", [])).toEqual({ ok: false, reason: "COUNTRY_NOT_ALLOWED" });
  });
});

describe("messages", () => {
  it.each(PURPOSES)("%s fits one SMS part in English and Arabic", (purpose) => {
    const en = buildPurposeMessage("en", "A very long shop name indeed", "123456", purpose);
    const ar = buildPurposeMessage("ar", "Shop", "123456", purpose);
    expect(en.length).toBeLessThanOrEqual(160);
    expect(/^[\x20-\x7e]+$/.test(en)).toBe(true);
    expect(ar.length).toBeLessThanOrEqual(70);
    expect(en).toContain("123456");
    expect(ar).toContain("123456");
  });
});
