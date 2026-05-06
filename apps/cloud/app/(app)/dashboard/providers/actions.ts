'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { sealSecret } from '@/lib/crypto';
import { requireTenant } from '@/lib/auth-gate';

const ProviderEnum = z.enum(['openai', 'anthropic', 'gemini', 'grok', 'groq']);

const PROVIDER_BASE_URLS: Record<string, string | null> = {
  openai: null,
  anthropic: null,
  gemini: null,
  grok: 'https://api.x.ai/v1',
  // Groq is OpenAI-compatible; we store it as `openai` provider with a baseUrl override.
  groq: 'https://api.groq.com/openai/v1',
};

const Schema = z.object({
  provider: ProviderEnum,
  label: z.string().trim().min(1).max(60),
  apiKey: z.string().trim().min(8),
  model: z.string().trim().min(1).max(80),
  baseUrl: z
    .string()
    .trim()
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export async function createProvider(formData: FormData) {
  const tenant = await requireTenant();
  const parsed = Schema.parse({
    provider: formData.get('provider'),
    label: formData.get('label'),
    apiKey: formData.get('apiKey'),
    model: formData.get('model'),
    baseUrl: formData.get('baseUrl') || undefined,
  });

  // Map "groq" UI choice to underlying openai provider with the Groq base URL.
  const dbProvider = parsed.provider === 'groq' ? 'openai' : parsed.provider;
  const baseUrl =
    parsed.baseUrl ?? PROVIDER_BASE_URLS[parsed.provider] ?? null;

  const encryptedKey = await sealSecret(parsed.apiKey);

  await db.insert(schema.providerCredentials).values({
    tenantId: tenant.id,
    provider: dbProvider,
    label: `${parsed.label}${parsed.provider === 'groq' ? ' (Groq)' : ''}`,
    encryptedKey,
    model: parsed.model,
    baseUrl,
  });

  revalidatePath('/dashboard/providers');
  revalidatePath('/dashboard/assistant');
}

export async function deleteProvider(formData: FormData) {
  const tenant = await requireTenant();
  const id = z.string().uuid().parse(formData.get('id'));

  await db
    .delete(schema.providerCredentials)
    .where(
      and(
        eq(schema.providerCredentials.id, id),
        eq(schema.providerCredentials.tenantId, tenant.id),
      ),
    );

  revalidatePath('/dashboard/providers');
  revalidatePath('/dashboard/assistant');
}
