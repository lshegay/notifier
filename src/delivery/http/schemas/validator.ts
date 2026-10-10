import { zValidator as honoZValidator } from '@hono/zod-validator';
import type { Context, Env, ValidationTargets } from 'hono';
import type { z, ZodType } from 'zod';

export type SchemaMap = Partial<Record<keyof ValidationTargets, ZodType>>;

/**
 * Type generator that produces a strongly-typed Hono Context based on target(s) and Zod schema(s).
 *
 * Supports two usage styles:
 * 1. Single target:
 *    `ValidatedContext<"param", typeof idParamSchema>`
 *    `ValidatedContext<"json", typeof bodySchema>`
 *
 * 2. Multiple targets:
 *    `ValidatedContext<{ param: typeof idParamSchema; json: typeof bodySchema }>`
 */
export type ValidatedContext<
  TargetOrMap extends keyof ValidationTargets | SchemaMap,
  SingleSchema extends ZodType = never,
  E extends Env = any,
  P extends string = any,
> = TargetOrMap extends keyof ValidationTargets
  ? Context<
      E,
      P,
      {
        in: { [K in TargetOrMap]: z.input<SingleSchema> };
        out: { [K in TargetOrMap]: z.output<SingleSchema> };
      }
    >
  : TargetOrMap extends SchemaMap
    ? Context<
        E,
        P,
        {
          in: {
            [K in keyof TargetOrMap & keyof ValidationTargets]: TargetOrMap[K] extends ZodType
              ? z.input<TargetOrMap[K]>
              : never;
          };
          out: {
            [K in keyof TargetOrMap & keyof ValidationTargets]: TargetOrMap[K] extends ZodType
              ? z.output<TargetOrMap[K]>
              : never;
          };
        }
      >
    : Context<E, P>;

export type TypedContext<
  TargetOrMap extends keyof ValidationTargets | SchemaMap,
  SingleSchema extends ZodType = never,
  E extends Env = any,
  P extends string = any,
> = ValidatedContext<TargetOrMap, SingleSchema, E, P>;

export const validate = <Target extends keyof ValidationTargets, T extends ZodType>(
  target: Target,
  schema: T
) =>
  honoZValidator(target, schema, (result, c) => {
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return c.json(
        {
          error: firstIssue?.message || 'Validation failed',
          details: result.error.issues,
        },
        400
      );
    }
  });
