import type { NotifyUsecase } from '../../../usecase/notify.usecase';
import type { notifyParamSchema, notifyBodySchema } from '../schemas/notify.schema';
import type { ValidatedContext } from '../schemas/validator';

export type NotifyContext = ValidatedContext<{
  param: typeof notifyParamSchema;
  json: typeof notifyBodySchema;
}>;

export class NotifyHandler {
  constructor(private readonly notifyUsecase: NotifyUsecase) {}

  async notify(c: NotifyContext): Promise<Response> {
    const { id } = c.req.valid('param');
    const { args } = c.req.valid('json');

    const result = await this.notifyUsecase.execute(id, args);
    return c.json({ success: true, data: result }, 200);
  }
}
