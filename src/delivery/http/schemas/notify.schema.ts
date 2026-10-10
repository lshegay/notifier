import { z } from 'zod';

export const notifyParamSchema = z.object({
  id: z.string().min(1, 'Template ID must not be empty'),
});

export const notifyBodySchema = z.object({
  args: z.record(z.string(), z.unknown(), {
    message: "Body must contain an object property 'args'",
  }),
});

export type NotifyBodyInput = z.infer<typeof notifyBodySchema>;
export type NotifyParamInput = z.infer<typeof notifyParamSchema>;
