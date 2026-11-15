/*
FILE:      packages/core/src/digits.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      Arabic-Indic and Persian digits to ASCII.
WHY:       Users type phone numbers in either digit set; the gateway needs ASCII digits.
SYNCED:    synced from kwtsms-better-auth src/digits.ts 2026-11-16 (body unchanged)
*/

export function toAsciiDigits(input: string): string {
  return Array.from(input, (ch) => {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x0660 && cp <= 0x0669) return String(cp - 0x0660);
    if (cp >= 0x06f0 && cp <= 0x06f9) return String(cp - 0x06f0);
    return ch;
  }).join("");
}
