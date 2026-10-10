import { z } from 'zod';

export const loginBodySchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  onlyNotify: z.boolean().optional().default(false),
});

export const registerBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required and must not be empty'),
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  role: z.enum(['admin', 'user']).optional().default('user'),
  template_ids: z.array(z.string().min(1)).optional().default([]),
});

export type LoginInput = z.infer<typeof loginBodySchema>;
export type RegisterInput = z.infer<typeof registerBodySchema>;
