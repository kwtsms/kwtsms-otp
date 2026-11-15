/*
FILE:      packages/core/src/sender.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      SmsSender interface and createKwtSender (kwtsms npm library): test mode by default, live needs your own Sender ID.
WHY:       The core never imports a vendor client directly; tests inject a fake, production uses this one.
*/

import { KwtSMS } from "kwtsms";

export interface SendOutcome {
  result: string;
  code?: string;
  description?: string;
}

export interface SmsSender {
  send(mobile: string, message: string): Promise<SendOutcome>;
}

export const SHARED_SENDER_ID = "KWT-SMS";

export interface KwtSenderOptions {
  username?: string;
  password?: string;
  /** Default "KWT-SMS" (shared test Sender ID, refused when live). */
  senderId?: string;
  /** Default false: kwtSMS test mode (test=1), queued, not delivered. */
  live?: boolean;
}

export function createKwtSender(options: KwtSenderOptions): SmsSender {
  const live = options.live === true;
  const senderId = options.senderId ?? SHARED_SENDER_ID;
  if (!options.username || !options.password) throw new Error("[kwtsms-otp] createKwtSender needs username and password");
  if (live && (!senderId || senderId === SHARED_SENDER_ID)) {
    throw new Error(`[kwtsms-otp] live mode needs your own senderId, not the shared ${SHARED_SENDER_ID}`);
  }
  const kwt = new KwtSMS(options.username, options.password, {
    senderId,
    testMode: !live,
    logFile: "", // the library would log message text (the code)
    appName: "kwtsms-otp",
  });
  return {
    async send(mobile, message) {
      const r = await kwt.send(mobile, message);
      return { result: r.result, code: r.code, description: r.description };
    },
  };
}
