import type { AuthUsecase } from '../../../usecase/auth.usecase';
import type { User } from '../../../domain/user';
import { ForbiddenError } from '../../../domain/errors';
import type { loginBodySchema, registerBodySchema } from '../schemas/auth.schema';
import type { ValidatedContext } from '../schemas/validator';

export type LoginContext = ValidatedContext<'json', typeof loginBodySchema>;
export type RegisterContext = ValidatedContext<'json', typeof registerBodySchema>;

export class AuthHandler {
  constructor(private readonly authUsecase: AuthUsecase) {}

  async login(c: LoginContext): Promise<Response> {
    const { email, password, onlyNotify } = c.req.valid('json');
    const result = await this.authUsecase.login(email, password, onlyNotify);
    return c.json(result, 200);
  }

  async register(c: RegisterContext): Promise<Response> {
    const onlyNotify = c.get('onlyNotify') as boolean | undefined;
    if (onlyNotify) {
      throw new ForbiddenError('Token with onlyNotify scope has access only to notify endpoints');
    }

    const data = c.req.valid('json');
    const currentUser = c.get('user') as User | undefined;
    const created = await this.authUsecase.register(data, currentUser?.role);
    return c.json(created, 201);
  }
}
