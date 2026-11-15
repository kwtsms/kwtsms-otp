/*
FILE:      starter/src/serve-bun.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      serveBun(app, port, host): start a Hono app with Bun.serve and pass the socket address.
WHY:       Bun.serve hands the server to fetch(); server.requestIP(req) is the TCP peer for the per-IP limit.
*/

import type { Hono } from "hono";
import type { AppEnv } from "./app";

// 2026-11-16 02:00 +03: minimal Bun typing instead of the bun-types package (one call site). int-node-boilerplates
interface BunServer {
  port: number;
  requestIP(req: Request): { address: string } | null;
  stop(): void;
}
type BunGlobal = { serve(o: { port: number; hostname: string; fetch(req: Request, server: BunServer): Response | Promise<Response> }): BunServer };

export function serveBun(app: Hono<AppEnv>, port: number, host: string): { port: number; close: () => void } {
  const Bun = (globalThis as unknown as { Bun: BunGlobal }).Bun;
  const server = Bun.serve({
    port,
    hostname: host,
    fetch: (req, srv) => app.fetch(req, { socketIp: srv.requestIP(req)?.address }),
  });
  return { port: server.port, close: () => server.stop() };
}
