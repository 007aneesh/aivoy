import { z } from 'zod';

const ServerEnv = z.object({
  CLERK_SECRET_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
  AIVOY_MASTER_KEY: z
    .string()
    .min(1, 'AIVOY_MASTER_KEY is required (32 random bytes, base64-encoded)'),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

const ClientEnv = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export const serverEnv = (() => {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv accessed on the client');
  }
  return ServerEnv.parse(process.env);
})();

export const clientEnv = ClientEnv.parse({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});
