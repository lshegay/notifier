import { Hono } from 'hono';
import type { ProviderHandler } from './handlers/provider.handler';
import type { TemplateHandler } from './handlers/template.handler';
import type { NotifyHandler } from './handlers/notify.handler';
import { validate } from './schemas/validator';
import {
  providerIdParamSchema,
  createProviderBodySchema,
  updateProviderBodySchema,
} from './schemas/provider.schema';
import {
  templateIdParamSchema,
  createTemplateBodySchema,
  updateTemplateBodySchema,
} from './schemas/template.schema';
import { notifyParamSchema, notifyBodySchema } from './schemas/notify.schema';
import { ProviderNotFoundError, TemplateNotFoundError, ValidationError } from '../../domain/errors';

export type AppDependencies = {
  providerHandler: ProviderHandler;
  templateHandler: TemplateHandler;
  notifyHandler: NotifyHandler;
};

export function createHonoApp(deps: AppDependencies): Hono {
  const { providerHandler, templateHandler, notifyHandler } = deps;
  const app = new Hono();

  // Error handling middleware
  app.onError((err, c) => {
    if (err instanceof ValidationError) {
      return c.json({ error: err.message }, 400);
    }
    if (err instanceof ProviderNotFoundError || err instanceof TemplateNotFoundError) {
      return c.json({ error: err.message }, 404);
    }

    console.error('Unhandled error:', err);
    return c.json({ error: 'Internal Server Error' }, 500);
  });

  // 404 fallback
  app.notFound((c) => {
    return c.json({ error: `Not Found: ${c.req.method} ${c.req.path}` }, 404);
  });

  // --- Provider routes ---
  // POST /provider
  app.post('/provider', validate('json', createProviderBodySchema), (c) =>
    providerHandler.create(c)
  );

  // GET /provider
  app.get('/provider', (c) => providerHandler.list(c));

  // GET /provider/:id
  app.get('/provider/:id', validate('param', providerIdParamSchema), (c) =>
    providerHandler.getById(c)
  );

  // PUT /provider/:id
  app.put(
    '/provider/:id',
    validate('param', providerIdParamSchema),
    validate('json', updateProviderBodySchema),
    (c) => providerHandler.update(c)
  );

  // DELETE /provider/:id
  app.delete('/provider/:id', validate('param', providerIdParamSchema), (c) =>
    providerHandler.delete(c)
  );

  // --- Notify routes ---
  // POST /notify/:id
  app.post(
    '/notify/:id',
    validate('param', notifyParamSchema),
    validate('json', notifyBodySchema),
    (c) => notifyHandler.notify(c)
  );

  // --- Template routes ---
  // POST /template
  app.post('/template', validate('json', createTemplateBodySchema), (c) =>
    templateHandler.create(c)
  );

  // GET /template
  app.get('/template', (c) => templateHandler.list(c));

  // GET /template/:id
  app.get('/template/:id', validate('param', templateIdParamSchema), (c) =>
    templateHandler.getById(c)
  );

  // PUT /template/:id
  app.put(
    '/template/:id',
    validate('param', templateIdParamSchema),
    validate('json', updateTemplateBodySchema),
    (c) => templateHandler.update(c)
  );

  // DELETE /template/:id
  app.delete('/template/:id', validate('param', templateIdParamSchema), (c) =>
    templateHandler.delete(c)
  );

  return app;
}
