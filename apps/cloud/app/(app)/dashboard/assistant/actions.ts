'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireTenant } from '@/lib/auth-gate';

const Schema = z.object({
  name: z.string().trim().min(1).max(60),
  greeting: z
    .string()
    .trim()
    .max(280)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  systemPrompt: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  suggestedPrompts: z
    .string()
    .transform((s) =>
      s
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(0, 8),
    ),
  providerCredentialId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export async function saveAssistant(formData: FormData) {
  const tenant = await requireTenant();
  const parsed = Schema.parse({
    name: formData.get('name'),
    greeting: formData.get('greeting'),
    systemPrompt: formData.get('systemPrompt'),
    suggestedPrompts: formData.get('suggestedPrompts'),
    providerCredentialId: formData.get('providerCredentialId') || undefined,
  });

  // Validate the credential belongs to this tenant if provided.
  if (parsed.providerCredentialId) {
    const [cred] = await db
      .select({ id: schema.providerCredentials.id })
      .from(schema.providerCredentials)
      .where(eq(schema.providerCredentials.id, parsed.providerCredentialId))
      .limit(1);
    if (!cred) throw new Error('Provider credential not found');
  }

  await db
    .insert(schema.assistants)
    .values({
      tenantId: tenant.id,
      name: parsed.name,
      greeting: parsed.greeting ?? null,
      systemPrompt: parsed.systemPrompt ?? null,
      suggestedPrompts: parsed.suggestedPrompts,
      providerCredentialId: parsed.providerCredentialId ?? null,
    })
    .onConflictDoUpdate({
      target: schema.assistants.tenantId,
      set: {
        name: parsed.name,
        greeting: parsed.greeting ?? null,
        systemPrompt: parsed.systemPrompt ?? null,
        suggestedPrompts: parsed.suggestedPrompts,
        providerCredentialId: parsed.providerCredentialId ?? null,
      },
    });

  revalidatePath('/dashboard/assistant');
  revalidatePath('/dashboard');
}
