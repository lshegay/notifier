import type { Context } from 'hono';
import type { ProviderUsecase } from '../../../usecase/provider.usecase';
import type {
  createProviderBodySchema,
  updateProviderBodySchema,
  providerIdParamSchema,
} from '../schemas/provider.schema';
import type { ValidatedContext } from '../schemas/validator';

export type CreateProviderContext = ValidatedContext<'json', typeof createProviderBodySchema>;
export type GetProviderContext = ValidatedContext<'param', typeof providerIdParamSchema>;
export type UpdateProviderContext = ValidatedContext<{
  param: typeof providerIdParamSchema;
  json: typeof updateProviderBodySchema;
}>;
export type DeleteProviderContext = ValidatedContext<'param', typeof providerIdParamSchema>;

export class ProviderHandler {
  constructor(private readonly providerUsecase: ProviderUsecase) {}

  async create(c: CreateProviderContext): Promise<Response> {
    const data = c.req.valid('json');
    const created = await this.providerUsecase.createProvider(data);
    return c.json(created, 201);
  }

  async getById(c: GetProviderContext): Promise<Response> {
    const { id } = c.req.valid('param');
    const provider = await this.providerUsecase.getProvider(id);
    return c.json(provider, 200);
  }

  async list(c: Context): Promise<Response> {
    const type = c.req.query('type');
    const providers = await this.providerUsecase.listProviders(type);
    return c.json(providers, 200);
  }

  async update(c: UpdateProviderContext): Promise<Response> {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const updated = await this.providerUsecase.updateProvider(id, data);
    return c.json(updated, 200);
  }

  async delete(c: DeleteProviderContext): Promise<Response> {
    const { id } = c.req.valid('param');
    await this.providerUsecase.deleteProvider(id);
    return c.json({ success: true, message: `Provider ${id} deleted` }, 200);
  }
}
