import { Hono, type MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import type { ProviderHandler } from './handlers/provider.handler';
import type { TemplateHandler } from './handlers/template.handler';
import type { NotifyHandler } from './handlers/notify.handler';
import type { AuthHandler } from './handlers/auth.handler';
import type { QuickRegisterHandler } from './handlers/quick-register.handler';
import type { AuthUsecase } from '../../usecase/auth.usecase';
import type { UserRepository } from '../../usecase/user.repository';
import type { ProviderRepository } from '../../usecase/provider.repository';
import type { TemplateRepository } from '../../usecase/template.repository';
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
import { quickRegisterBodySchema } from './schemas/quick-register.schema';
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
  quickRegisterHandler: QuickRegisterHandler;
  authUsecase: AuthUsecase;
  userRepo: UserRepository;
  providerRepo: ProviderRepository;
  templateRepo: TemplateRepository;
};

export function createHonoApp(deps: AppDependencies): Hono {
  const {
    providerHandler,
    templateHandler,
    notifyHandler,
    authHandler,
    quickRegisterHandler,
    authUsecase,
    userRepo,
    providerRepo,
    templateRepo,
  } = deps;
  const app = new Hono();

  const authMiddleware = authenticate(authUsecase, userRepo);
  const adminMiddleware = requireRole('admin');
  const templateAccessMiddleware = requireTemplateAccess();

  // Helper to fetch allowed origins from the provider linked to a template
  const getAllowedOriginsForTemplate = async (templateId: string): Promise<string[] | null> => {
    const template = await templateRepo.findById(templateId);
    if (!template) {
      return null;
    }
    const provider = await providerRepo.findById(template.provider_id);
    if (!provider) {
      return null;
    }
    return provider.origins ?? [];
  };

  const isOriginAllowed = (origin: string, allowedOrigins: string[]): boolean => {
    const normalizedOrigin = origin.trim().replace(/\/$/, '').toLowerCase();
    return allowedOrigins.some((pattern) => {
      const trimmed = pattern.trim().toLowerCase();
      if (trimmed === '*') {
        return true;
      }
      return trimmed.replace(/\/$/, '') === normalizedOrigin;
    });
  };

  // 1. General CORS for non-notify routes
  app.use('*', async (c, next) => {
    if (c.req.path.startsWith('/notify/')) {
      return next();
    }
    return cors()(c, next);
  });

  // 2. CORS middleware for /notify/:id based on provider.origins
  app.use(
    '/notify/:id',
    cors({
      origin: async (origin, c) => {
        const templateId = c.req.param('id');
        if (!templateId || !origin) {
          return null;
        }
        const allowedOrigins = await getAllowedOriginsForTemplate(templateId);
        if (!allowedOrigins) {
          return null;
        }
        return isOriginAllowed(origin, allowedOrigins) ? origin : null;
      },
      allowMethods: ['POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // 3. Origin verification middleware for POST /notify/:id
  const requireAllowedOrigin = (): MiddlewareHandler => {
    return async (c, next) => {
      const origin = c.req.header('origin');
      if (origin) {
        const templateId = c.req.param('id');
        if (templateId) {
          const allowedOrigins = await getAllowedOriginsForTemplate(templateId);
          if (allowedOrigins) {
            if (!isOriginAllowed(origin, allowedOrigins)) {
              throw new ForbiddenError(
                `Origin '${origin}' is not allowed to send notifications for this template`
              );
            }
          }
        }
      }
      await next();
    };
  };

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

  // --- Quick Register route (requires authentication + role == 'admin') ---
  // POST /quick-register
  app.post(
    '/quick-register',
    authMiddleware,
    adminMiddleware,
    validate('json', quickRegisterBodySchema),
    (c) => quickRegisterHandler.quickRegister(c)
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
    requireAllowedOrigin(),
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
