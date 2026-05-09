'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireTenant } from '@/lib/auth-gate';

const optionalString = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal('').transform(() => undefined));

const Schema = z.object({
  name: z.string().trim().min(1).max(60),
  greeting: optionalString(280),
  systemPrompt: optionalString(4000),
  suggestedPrompts: z
    .string()
    .transform((s) =>
      s
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(0, 8),
    ),
  providerCredentialId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
  avatarUrl: optionalString(500).pipe(
    z.union([z.string().url(), z.undefined()]).optional(),
  ),
  themeAccent: optionalString(20).pipe(
    z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex like #7c3aed')
      .or(z.undefined())
      .optional(),
  ),
  themeMode: z.enum(['auto', 'light', 'dark']).optional(),
  themePosition: z.enum(['bottom-right', 'bottom-left']).optional(),
});

export async function saveAssistant(formData: FormData) {
  const tenant = await requireTenant();
  const parsed = Schema.parse({
    name: formData.get('name'),
    greeting: formData.get('greeting'),
    systemPrompt: formData.get('systemPrompt'),
    suggestedPrompts: formData.get('suggestedPrompts'),
    providerCredentialId: formData.get('providerCredentialId') || undefined,
    avatarUrl: formData.get('avatarUrl'),
    themeAccent: formData.get('themeAccent'),
    themeMode: formData.get('themeMode') || undefined,
    themePosition: formData.get('themePosition') || undefined,
  });

  if (parsed.providerCredentialId) {
    const [cred] = await db
      .select({ id: schema.providerCredentials.id })
      .from(schema.providerCredentials)
      .where(eq(schema.providerCredentials.id, parsed.providerCredentialId))
      .limit(1);
    if (!cred) throw new Error('Provider credential not found');
  }

  const theme: Record<string, unknown> = {};
  if (parsed.themeAccent)   theme.accent   = parsed.themeAccent;
  if (parsed.themeMode)     theme.mode     = parsed.themeMode;
  if (parsed.themePosition) theme.position = parsed.themePosition;

  const row = {
    tenantId: tenant.id,
    name: parsed.name,
    greeting: parsed.greeting ?? null,
    systemPrompt: parsed.systemPrompt ?? null,
    suggestedPrompts: parsed.suggestedPrompts,
    providerCredentialId: parsed.providerCredentialId ?? null,
    avatarUrl: parsed.avatarUrl ?? null,
    theme,
  };

  await db
    .insert(schema.assistants)
    .values(row)
    .onConflictDoUpdate({ target: schema.assistants.tenantId, set: row });

  revalidatePath('/dashboard/assistant');
  revalidatePath('/dashboard');
}
