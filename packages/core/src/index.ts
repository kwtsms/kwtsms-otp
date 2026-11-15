/*
FILE:      packages/core/src/index.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      Public entry of kwtsms-otp: createOtp, stores, IP helper, messages, phone helpers.
WHY:       One import for apps; the SQL store lives in kwtsms-otp/libsql and the sender in kwtsms-otp/sender.
*/

export { createOtp, generateCode } from "./otp";
export type { Otp, OtpOptions, SendRequest, SendResult, SendReason, VerifyRequest, VerifyResult, VerifyReason, Logger } from "./otp";
export { MemoryStore } from "./store";
export type { OtpStore, OtpRecord } from "./store";
export { KvStore } from "./kv";
export type { KvLike } from "./kv";
export { getClientIp } from "./ip";
export type { ClientIpOptions } from "./ip";
export { buildPurposeMessage, PURPOSES } from "./messages";
export type { Purpose } from "./messages";
export { normalizePhone } from "./phone";
export type { PhoneResult } from "./phone";
export { toAsciiDigits } from "./digits";
export { buildOtpMessage, safeAppName } from "./template";
export type { Lang } from "./template";
export type { SmsSender, SendOutcome } from "./sender";
