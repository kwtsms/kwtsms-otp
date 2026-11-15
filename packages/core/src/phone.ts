/*
FILE:      packages/core/src/phone.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      Normalizes phone input (Arabic/Persian digits, + and 00, 8-digit Kuwait local) and applies the country allowlist.
WHY:       Non-allowed countries must be refused before any code is made or SMS is queued.
SYNCED:    synced from kwtsms-better-auth src/phone.ts 2026-11-16 (body unchanged)
*/

import { findCountryCode, validatePhoneInput } from "kwtsms";
import { toAsciiDigits } from "./digits";

export type PhoneResult =
  | { ok: true; digits: string; country: string }
  | { ok: false; reason: "INVALID_PHONE" | "COUNTRY_NOT_ALLOWED" };

export function normalizePhone(raw: string, allowedCountries: string[]): PhoneResult {
  const ascii = toAsciiDigits(String(raw ?? "")).trim();
  if (ascii === "" || ascii.length > 25 || !/^[+\d\s().-]+$/.test(ascii)) {
    return { ok: false, reason: "INVALID_PHONE" };
  }
  let digits = ascii.replace(/\D/g, "");
  // 8-digit local Kuwait number without a country code.
  if (digits.length === 8 && !ascii.startsWith("+") && !ascii.startsWith("00")) {
    digits = `965${digits}`;
  }
  const [valid, , normalized] = validatePhoneInput(digits);
  if (!valid) return { ok: false, reason: "INVALID_PHONE" };
  const country = findCountryCode(normalized);
  if (!country || !allowedCountries.includes(country)) {
    return { ok: false, reason: "COUNTRY_NOT_ALLOWED" };
  }
  return { ok: true, digits: normalized, country };
}
