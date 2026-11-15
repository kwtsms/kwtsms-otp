/*
FILE:      starter/src/serve-node.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      serveNode(app, port, host): start a Hono app on Node with @hono/node-server and pass the socket address.
WHY:       The per-IP limit needs the TCP peer; on Node it is env.incoming.socket.remoteAddress (hono.dev Node.js guide).
*/

import { serve, type Http2Bindings, type HttpBindings } from "@hono/node-server";
import type { Hono } from "hono";
import type { AppEnv } from "./app";

export function serveNode(app: Hono<AppEnv>, port: number, host: string): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve) => {
    const server = serve(
      {
        fetch: (req: Request, env: HttpBindings | Http2Bindings) => app.fetch(req, { socketIp: env.incoming.socket.remoteAddress }),
        port,
        hostname: host,
      },
      (info) => resolve({ port: info.port, close: () => server.close() }),
    );
  });
}
