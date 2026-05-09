import { z } from 'zod';

const ServerEnv = z.object({
  CLERK_SECRET_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
  AIVOY_MASTER_KEY: z
    .string()
    .min(1, 'AIVOY_MASTER_KEY is required (32 random bytes, base64-encoded)'),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});
type ServerEnv = z.infer<typeof ServerEnv>;

const ClientEnv = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});
type ClientEnv = z.infer<typeof ClientEnv>;

// Validate lazily on first property access — not at module load. Lets
// `next build` finish without the secrets present (build hosts that don't
// inject runtime env into the build step). Misconfigured prod still throws
// on the first request, which is what we want.
let _server: ServerEnv | null = null;
export const serverEnv = new Proxy({} as ServerEnv, {
  get(_t, key: string) {
    if (typeof window !== 'undefined') {
      throw new Error('serverEnv accessed on the client');
    }
    if (!_server) _server = ServerEnv.parse(process.env);
    return _server[key as keyof ServerEnv];
  },
});

let _client: ClientEnv | null = null;
export const clientEnv = new Proxy({} as ClientEnv, {
  get(_t, key: string) {
    if (!_client) {
      _client = ClientEnv.parse({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      });
    }
    return _client[key as keyof ClientEnv];
  },
});
