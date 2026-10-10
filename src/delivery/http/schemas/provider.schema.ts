import { z } from 'zod';
import { NotificationType } from '../../../domain/notification';
import { validateTelegramOptions } from '../../../domain/provider';

export const providerIdParamSchema = z.object({
  id: z.string().min(1, 'Provider ID must not be empty'),
});

const supportedNotificationTypes = Object.values(NotificationType) as string[];

export const createProviderBodySchema = z
  .object({
    name: z.string().trim().min(1, 'Provider name is required and must not be empty'),
    type: z
      .string()
      .trim()
      .toLowerCase()
      .refine((val) => supportedNotificationTypes.includes(val), {
        message: `Invalid provider type. Supported types: ${supportedNotificationTypes.join(', ')}`,
      }),
    options: z.record(z.string(), z.unknown()).optional().default({}),
    origins: z.array(z.string()).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.type === NotificationType.TELEGRAM) {
      try {
        validateTelegramOptions(data.options);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Invalid Telegram provider options';
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message,
        });
      }
    }
  });

export const updateProviderBodySchema = z
  .object({
    name: z.string().trim().min(1, 'Provider name must not be empty').optional(),
    type: z
      .string()
      .trim()
      .toLowerCase()
      .refine((val) => supportedNotificationTypes.includes(val), {
        message: `Invalid provider type. Supported types: ${supportedNotificationTypes.join(', ')}`,
      })
      .optional(),
    options: z.record(z.string(), z.unknown()).optional(),
    origins: z.array(z.string()).optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.type !== undefined ||
      data.options !== undefined ||
      data.origins !== undefined,
    {
      message: "At least one of 'name', 'type', 'options', or 'origins' must be provided",
    }
  )
  .superRefine((data, ctx) => {
    if (data.type === NotificationType.TELEGRAM && data.options !== undefined) {
      try {
        validateTelegramOptions(data.options);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Invalid Telegram provider options';
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message,
        });
      }
    }
  });

export const providerQuerySchema = z.object({
  type: z.string().optional(),
});

export type CreateProviderInput = z.infer<typeof createProviderBodySchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderBodySchema>;
export type ProviderIdParam = z.infer<typeof providerIdParamSchema>;
export type ProviderQuery = z.infer<typeof providerQuerySchema>;
