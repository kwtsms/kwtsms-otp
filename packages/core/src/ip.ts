/*
FILE:      packages/core/src/ip.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      getClientIp(request, opts): the caller IP for rate limits, per runtime.
WHY:       x-forwarded-for is client-controlled; it is read only when trustProxy is set, so a bot cannot rotate it to dodge the per-IP cap.
*/

export interface ClientIpOptions {
  /** Address of the TCP peer: Node req.socket.remoteAddress, Bun server.requestIP(req)?.address. */
  socketIp?: string;
  /** true only behind a proxy you control that appends to x-forwarded-for. Default false. */
  trustProxy?: boolean;
  /** true on Cloudflare Workers: cf-connecting-ip is set by Cloudflare and cannot be forged by the client. */
  cloudflare?: boolean;
}

const IP_SHAPE = /^[0-9a-fA-F:.]{2,45}$/;

function clean(v: string | null | undefined): string | undefined {
  const s = (v ?? "").trim();
  return IP_SHAPE.test(s) ? s : undefined;
}

/**
 * Order: cloudflare -> cf-connecting-ip; trustProxy -> the LAST x-forwarded-for entry (the one your own proxy appended;
 * the first entries are whatever the client sent); otherwise the socket address; otherwise "unknown".
 */
export function getClientIp(request: { headers: { get(name: string): string | null } }, opts: ClientIpOptions = {}): string {
  if (opts.cloudflare) {
    const cf = clean(request.headers.get("cf-connecting-ip"));
    if (cf) return cf;
  }
  if (opts.trustProxy) {
    const parts = (request.headers.get("x-forwarded-for") ?? "").split(",");
    const last = clean(parts[parts.length - 1]);
    if (last) return last;
  }
  return clean(opts.socketIp) ?? "unknown";
}
