import type { Context, MiddlewareHandler } from 'hono';
import type { AuthUsecase } from '../../../usecase/auth.usecase';
import type { UserRepository } from '../../../usecase/user.repository';
import type { User } from '../../../domain/user';
import { ForbiddenError, UnauthorizedError } from '../../../domain/errors';

export type AuthContextVariables = {
  user: User;
  onlyNotify: boolean;
};

export function authenticate(
  authUsecase: AuthUsecase,
  userRepo: UserRepository
): MiddlewareHandler {
  return async (c: Context, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authorization header with Bearer token is required');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new UnauthorizedError('Bearer token is empty');
    }

    const payload = await authUsecase.verifyToken(token);
    const user = await userRepo.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    c.set('user', user);
    c.set('onlyNotify', Boolean(payload.onlyNotify));
    await next();
  };
}

export function optionalAuthenticate(
  authUsecase: AuthUsecase,
  userRepo: UserRepository
): MiddlewareHandler {
  return async (c: Context, next) => {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        try {
          const payload = await authUsecase.verifyToken(token);
          const user = await userRepo.findById(payload.sub);
          if (user) {
            c.set('user', user);
            c.set('onlyNotify', Boolean(payload.onlyNotify));
          }
        } catch {
          // Token invalid, continue without user
        }
      }
    }
    await next();
  };
}

export function requireRole(role: string): MiddlewareHandler {
  return async (c: Context, next) => {
    const onlyNotify = c.get('onlyNotify') as boolean | undefined;
    if (onlyNotify) {
      throw new ForbiddenError('Token with onlyNotify scope has access only to notify endpoints');
    }

    const user = c.get('user') as User | undefined;
    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }
    if (user.role !== role) {
      throw new ForbiddenError(`Action requires '${role}' role`);
    }
    await next();
  };
}

export function requireTemplateAccess(): MiddlewareHandler {
  return async (c: Context, next) => {
    const user = c.get('user') as User | undefined;
    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }

    const templateId = c.req.param('id');
    if (!templateId) {
      throw new ForbiddenError('Template ID parameter is required');
    }

    const hasAccess = user.template_ids.includes(templateId);
    if (!hasAccess) {
      throw new ForbiddenError(`User does not have access to template '${templateId}'`);
    }

    await next();
  };
}
