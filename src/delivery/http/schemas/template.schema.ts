import { z } from 'zod';

export const templateIdParamSchema = z.object({
  id: z.string().min(1, 'Template ID must not be empty'),
});

export const createTemplateBodySchema = z.object({
  name: z.string().trim().min(1, 'Template name is required and must not be empty'),
  content: z.string({
    message: 'Template content is required and must be a string',
  }),
  provider_id: z.string().trim().min(1, 'Provider ID is required and must not be empty'),
});

export const updateTemplateBodySchema = z
  .object({
    name: z.string().trim().min(1, 'Template name must not be empty').optional(),
    content: z.string().optional(),
    provider_id: z.string().trim().min(1, 'Provider ID must not be empty').optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined || data.content !== undefined || data.provider_id !== undefined,
    {
      message: "At least one of 'name', 'content', or 'provider_id' must be provided",
    }
  );

export const templateQuerySchema = z.object({
  provider_id: z.string().optional(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateBodySchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateBodySchema>;
export type TemplateIdParam = z.infer<typeof templateIdParamSchema>;
export type TemplateQuery = z.infer<typeof templateQuerySchema>;
