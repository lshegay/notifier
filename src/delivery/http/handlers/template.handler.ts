import type { Context } from 'hono';
import type { TemplateUsecase } from '../../../usecase/template.usecase';
import type {
  createTemplateBodySchema,
  updateTemplateBodySchema,
  templateIdParamSchema,
} from '../schemas/template.schema';
import type { ValidatedContext } from '../schemas/validator';

export type CreateTemplateContext = ValidatedContext<'json', typeof createTemplateBodySchema>;
export type GetTemplateContext = ValidatedContext<'param', typeof templateIdParamSchema>;
export type UpdateTemplateContext = ValidatedContext<{
  param: typeof templateIdParamSchema;
  json: typeof updateTemplateBodySchema;
}>;
export type DeleteTemplateContext = ValidatedContext<'param', typeof templateIdParamSchema>;

export class TemplateHandler {
  constructor(private readonly templateUsecase: TemplateUsecase) {}

  async create(c: CreateTemplateContext): Promise<Response> {
    const { name, content, provider_id } = c.req.valid('json');
    const created = await this.templateUsecase.createTemplate({ name, content, provider_id });
    return c.json(created, 201);
  }

  async getById(c: GetTemplateContext): Promise<Response> {
    const { id } = c.req.valid('param');
    const template = await this.templateUsecase.getTemplate(id);
    return c.json(template, 200);
  }

  async list(c: Context): Promise<Response> {
    const providerId = c.req.query('provider_id');
    const templates = await this.templateUsecase.listTemplates(providerId);
    return c.json(templates, 200);
  }

  async update(c: UpdateTemplateContext): Promise<Response> {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const updated = await this.templateUsecase.updateTemplate(id, data);
    return c.json(updated, 200);
  }

  async delete(c: DeleteTemplateContext): Promise<Response> {
    const { id } = c.req.valid('param');
    await this.templateUsecase.deleteTemplate(id);
    return c.json({ success: true, message: `Template ${id} deleted` }, 200);
  }
}
