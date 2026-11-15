/*
FILE:      packages/core/src/messages.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      SMS text per purpose (login, signup, phone, checkout) in English and Arabic.
WHY:       One fixed short text per use case keeps every code in one SMS part (160 ASCII or 70 Arabic characters).
*/

import { cleanMessage } from "kwtsms";
import { buildOtpMessage, safeAppName, type Lang } from "./template";

export type Purpose = "login" | "signup" | "phone" | "checkout";
export const PURPOSES: Purpose[] = ["login", "signup", "phone", "checkout"];

export function buildPurposeMessage(lang: Lang, appName: string, code: string, purpose: Purpose = "login"): string {
  if (purpose === "login" || purpose === "signup") return buildOtpMessage(lang, appName, code);
  const app = safeAppName(appName);
  const what =
    lang === "ar"
      ? purpose === "phone"
        ? "رمز تأكيد الرقم"
        : "رمز تأكيد الطلب"
      : purpose === "phone"
        ? "your code to confirm this number is"
        : "your code to confirm your order is";
  const text =
    lang === "ar" ? `${app}: ${what} ${code}. صالح 5 دقائق. لا تشاركه.` : `${app}: ${what} ${code}. Valid 5 min. Do not share it.`;
  return cleanMessage(text);
}
