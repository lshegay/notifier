import type { Hono } from 'hono';
export type ServerOptions = {
  port: number;
  hostname: string;
};

export function startServer(app: Hono, options: ServerOptions) {
  const { port, hostname } = options;

  const server = Bun.serve({
    port,
    hostname,
    fetch: app.fetch,
  });

  return server;
}
