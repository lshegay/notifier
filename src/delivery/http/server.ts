import type { Hono } from 'hono';

export type ServerOptions = {
  port?: number;
  hostname?: string;
};

export function startServer(app: Hono, options: ServerOptions = {}) {
  const port = options.port ?? Number(process.env.PORT || 3000);
  const hostname = options.hostname ?? '0.0.0.0';

  const server = Bun.serve({
    port,
    hostname,
    fetch: app.fetch,
  });

  return server;
}
