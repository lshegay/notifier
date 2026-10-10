import { Hono } from 'hono';
import type { ProviderHandler } from './handlers/provider.handler';
import type { TemplateHandler } from './handlers/template.handler';
import type { NotifyHandler } from './handlers/notify.handler';
import type { AuthHandler } from './handlers/auth.handler';
import type { AuthUsecase } from '../../usecase/auth.usecase';
import type { UserRepository } from '../../usecase/user.repository';
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
import { loginBodySchema, registerBodySchema } from './schemas/auth.schema';
import {
  authenticate,
  optionalAuthenticate,
  requireRole,
  requireTemplateAccess,
} from './middleware/auth.middleware';
import {
  ForbiddenError,
  ProviderNotFoundError,
  TemplateNotFoundError,
  UnauthorizedError,
  UserAlreadyExistsError,
  UserNotFoundError,
  ValidationError,
} from '../../domain/errors';

export type AppDependencies = {
  providerHandler: ProviderHandler;
  templateHandler: TemplateHandler;
  notifyHandler: NotifyHandler;
  authHandler: AuthHandler;
  authUsecase: AuthUsecase;
  userRepo: UserRepository;
};

export function createHonoApp(deps: AppDependencies): Hono {
  const { providerHandler, templateHandler, notifyHandler, authHandler, authUsecase, userRepo } =
    deps;
  const app = new Hono();

  const authMiddleware = authenticate(authUsecase, userRepo);
  const adminMiddleware = requireRole('admin');
  const templateAccessMiddleware = requireTemplateAccess();

  // Error handling middleware
  app.onError((err, c) => {
    if (err instanceof ValidationError) {
      return c.json({ error: err.message }, 400);
    }
    if (err instanceof UnauthorizedError) {
      return c.json({ error: err.message }, 401);
    }
    if (err instanceof ForbiddenError) {
      return c.json({ error: err.message }, 403);
    }
    if (
      err instanceof ProviderNotFoundError ||
      err instanceof TemplateNotFoundError ||
      err instanceof UserNotFoundError
    ) {
      return c.json({ error: err.message }, 404);
    }
    if (err instanceof UserAlreadyExistsError) {
      return c.json({ error: err.message }, 409);
    }

    console.error('Unhandled error:', err);
    return c.json({ error: 'Internal Server Error' }, 500);
  });

  // 404 fallback
  app.notFound((c) => {
    return c.json({ error: `Not Found: ${c.req.method} ${c.req.path}` }, 404);
  });

  // --- Auth routes ---
  // POST /auth/login & POST /login
  const handleLogin = (c: any) => authHandler.login(c);
  app.post('/auth/login', validate('json', loginBodySchema), handleLogin);
  app.post('/login', validate('json', loginBodySchema), handleLogin);

  // POST /auth/register & POST /register (only for role == 'admin', or initial bootstrap)
  const handleRegister = (c: any) => authHandler.register(c);
  app.post(
    '/auth/register',
    optionalAuthenticate(authUsecase, userRepo),
    validate('json', registerBodySchema),
    handleRegister
  );
  app.post(
    '/register',
    optionalAuthenticate(authUsecase, userRepo),
    validate('json', registerBodySchema),
    handleRegister
  );

  // --- Provider routes (require authentication + role == 'admin') ---
  // POST /provider
  app.post(
    '/provider',
    authMiddleware,
    adminMiddleware,
    validate('json', createProviderBodySchema),
    (c) => providerHandler.create(c)
  );

  // GET /provider
  app.get('/provider', authMiddleware, adminMiddleware, (c) => providerHandler.list(c));

  // GET /provider/:id
  app.get(
    '/provider/:id',
    authMiddleware,
    adminMiddleware,
    validate('param', providerIdParamSchema),
    (c) => providerHandler.getById(c)
  );

  // PUT /provider/:id
  app.put(
    '/provider/:id',
    authMiddleware,
    adminMiddleware,
    validate('param', providerIdParamSchema),
    validate('json', updateProviderBodySchema),
    (c) => providerHandler.update(c)
  );

  // DELETE /provider/:id
  app.delete(
    '/provider/:id',
    authMiddleware,
    adminMiddleware,
    validate('param', providerIdParamSchema),
    (c) => providerHandler.delete(c)
  );

  // --- Notify routes (require authentication + template_id in user.template_ids) ---
  // POST /notify/:id
  app.post(
    '/notify/:id',
    authMiddleware,
    templateAccessMiddleware,
    validate('param', notifyParamSchema),
    validate('json', notifyBodySchema),
    (c) => notifyHandler.notify(c)
  );

  // --- Template routes (require authentication + role == 'admin') ---
  // POST /template
  app.post(
    '/template',
    authMiddleware,
    adminMiddleware,
    validate('json', createTemplateBodySchema),
    (c) => templateHandler.create(c)
  );

  // GET /template
  app.get('/template', authMiddleware, adminMiddleware, (c) => templateHandler.list(c));

  // GET /template/:id
  app.get(
    '/template/:id',
    authMiddleware,
    adminMiddleware,
    validate('param', templateIdParamSchema),
    (c) => templateHandler.getById(c)
  );

  // PUT /template/:id
  app.put(
    '/template/:id',
    authMiddleware,
    adminMiddleware,
    validate('param', templateIdParamSchema),
    validate('json', updateTemplateBodySchema),
    (c) => templateHandler.update(c)
  );

  // DELETE /template/:id
  app.delete(
    '/template/:id',
    authMiddleware,
    adminMiddleware,
    validate('param', templateIdParamSchema),
    (c) => templateHandler.delete(c)
  );

  return app;
}
