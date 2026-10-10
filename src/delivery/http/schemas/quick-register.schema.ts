import { z } from 'zod';

export const quickRegisterBodySchema = z.object({
  name: z.string().min(1, 'Name is required and must not be empty'),
  content: z.string().min(1, 'Content is required and must not be empty'),
  template_type: z.string().min(1, 'template_type is required'),
  options: z.record(z.string(), z.unknown()).optional(),
  provider_options: z.record(z.string(), z.unknown()).optional(),
  origins: z.array(z.string()).optional(),
});

export type QuickRegisterBody = z.infer<typeof quickRegisterBodySchema>;
