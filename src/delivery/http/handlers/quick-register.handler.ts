import type { QuickRegisterUsecase } from '../../../usecase/quick-register.usecase';
import type { quickRegisterBodySchema } from '../schemas/quick-register.schema';
import type { ValidatedContext } from '../schemas/validator';

export type QuickRegisterContext = ValidatedContext<'json', typeof quickRegisterBodySchema>;

export class QuickRegisterHandler {
  constructor(private readonly quickRegisterUsecase: QuickRegisterUsecase) {}

  async quickRegister(c: QuickRegisterContext): Promise<Response> {
    const data = c.req.valid('json');
    const result = await this.quickRegisterUsecase.execute(data);
    return c.json(result, 201);
  }
}
