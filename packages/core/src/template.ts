/*
FILE:      packages/core/src/template.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      OTP SMS text in English (ASCII, 1 part of 160) and Arabic (UCS-2, 1 part of 70).
WHY:       Short fixed texts keep every code in one SMS part.
SYNCED:    synced from kwtsms-better-auth src/template.ts 2026-11-16 (body unchanged)
*/

import { cleanMessage } from "kwtsms";

export type Lang = "en" | "ar";

/** Keep the app name short and ASCII-safe so the message stays one part. */
export function safeAppName(name: string): string {
  return name.replace(/[^\x20-\x7e]/g, "").trim().slice(0, 16) || "App";
}

export function buildOtpMessage(lang: Lang, appName: string, code: string): string {
  const app = safeAppName(appName);
  const text =
    lang === "ar"
      ? `${app}: رمز التحقق ${code}. صالح 5 دقائق. لا تشاركه.`
      : `${app}: your code is ${code}. Valid 5 min. Do not share it.`;
  return cleanMessage(text);
}
