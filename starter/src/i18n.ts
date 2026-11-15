/*
FILE:      starter/src/i18n.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      English and Arabic UI strings for the 3 screens.
WHY:       No i18n library for 3 screens; wording follows the kwtSMS terms glossary.
*/

export type Lang = "en" | "ar";

export const dict = {
  en: {
    title: "Verify your phone",
    phoneLabel: "Mobile number",
    phoneHint: "Kuwait: 8 digits, or with +965",
    send: "Send code",
    codeLabel: "Verification code",
    codeHint: "Enter the 6-digit code from the SMS.",
    codeSent: "Code sent. Check your SMS.",
    verify: "Verify",
    change: "Use another number",
    done: "Number verified",
    otherLang: "العربية",
    demoBanner: "Demo: no SMS sent",
    testBanner: "Test mode: SMS queued, not delivered",
    demoCode: "Demo code",
    INVALID_PHONE: "Enter a valid mobile number.",
    COUNTRY_NOT_ALLOWED: "SMS to this country is not enabled.",
    COOLDOWN: "Please wait a moment before asking for another code.",
    LIMIT: "Too many requests. Try again later.",
    INVALID_OTP: "That code is not correct.",
    OTP_EXPIRED: "The code has expired. Send a new one.",
    TOO_MANY_ATTEMPTS: "Too many wrong attempts. Send a new code.",
    GENERIC: "Something went wrong. Try again.",
  },
  ar: {
    title: "تحقق من رقم جوالك",
    phoneLabel: "رقم الجوال",
    phoneHint: "الكويت: 8 أرقام، أو مع 965",
    send: "إرسال الرمز",
    codeLabel: "رمز التحقق (OTP)",
    codeHint: "أدخل الرمز المكون من 6 أرقام من الرسالة النصية.",
    codeSent: "تم إرسال الرمز. تحقق من رسائلك النصية.",
    verify: "تحقق",
    change: "استخدام رقم آخر",
    done: "تم التحقق من الرقم",
    otherLang: "English",
    demoBanner: "تجريبي: لم تُرسل أي رسالة",
    testBanner: "وضع التجربة: الرسالة في طابور الارسال ولم تُسلّم",
    demoCode: "رمز التجربة",
    INVALID_PHONE: "أدخل رقم جوال صحيح.",
    COUNTRY_NOT_ALLOWED: "الإرسال إلى هذه الدولة غير مفعّل.",
    COOLDOWN: "انتظر قليلاً قبل طلب رمز جديد.",
    LIMIT: "طلبات كثيرة. حاول لاحقاً.",
    INVALID_OTP: "الرمز غير صحيح.",
    OTP_EXPIRED: "انتهت صلاحية الرمز. أرسل رمزاً جديداً.",
    TOO_MANY_ATTEMPTS: "محاولات خاطئة كثيرة. أرسل رمزاً جديداً.",
    GENERIC: "حدث خطأ. حاول مرة أخرى.",
  },
} as const;

export type Strings = Record<keyof (typeof dict)["en"], string>;
export const dir = (lang: Lang) => (lang === "ar" ? "rtl" : "ltr");
