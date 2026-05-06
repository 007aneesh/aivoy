'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { generateWebhookSecret } from '@/lib/crypto';
import { requireTenant } from '@/lib/auth-gate';

const Schema = z.object({
  name: z
    .string()
    .trim()
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Name must be a valid identifier (letters, numbers, _)')
    .min(2)
    .max(48),
  description: z.string().trim().min(1).max(400),
  webhookUrl: z.string().trim().url(),
  inputSchema: z
    .string()
    .trim()
    .min(2)
    .transform((s, ctx) => {
      try {
        const parsed: unknown = JSON.parse(s);
        if (!parsed || typeof parsed !== 'object') {
          ctx.addIssue({ code: 'custom', message: 'Schema must be a JSON object' });
          return z.NEVER;
        }
        return parsed as Record<string, unknown>;
      } catch (e) {
        ctx.addIssue({
          code: 'custom',
          message: `Invalid JSON: ${(e as Error).message}`,
        });
        return z.NEVER;
      }
    }),
  renderAs: z
    .string()
    .trim()
    .max(60)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  enabled: z.preprocess((v) => v === 'on' || v === true, z.boolean()),
});

export async function createTool(formData: FormData) {
  const tenant = await requireTenant();
  const parsed = Schema.parse({
    name: formData.get('name'),
    description: formData.get('description'),
    webhookUrl: formData.get('webhookUrl'),
    inputSchema: formData.get('inputSchema'),
    renderAs: formData.get('renderAs') || undefined,
    enabled: formData.get('enabled'),
  });

  const webhookSecret = await generateWebhookSecret();

  await db.insert(schema.tools).values({
    tenantId: tenant.id,
    name: parsed.name,
    description: parsed.description,
    webhookUrl: parsed.webhookUrl,
    webhookSecret,
    inputSchema: parsed.inputSchema,
    renderAs: parsed.renderAs ?? null,
    enabled: parsed.enabled,
  });

  revalidatePath('/dashboard/tools');
}

export async function updateTool(formData: FormData) {
  const tenant = await requireTenant();
  const id = z.string().uuid().parse(formData.get('id'));
  const parsed = Schema.parse({
    name: formData.get('name'),
    description: formData.get('description'),
    webhookUrl: formData.get('webhookUrl'),
    inputSchema: formData.get('inputSchema'),
    renderAs: formData.get('renderAs') || undefined,
    enabled: formData.get('enabled'),
  });

  await db
    .update(schema.tools)
    .set({
      name: parsed.name,
      description: parsed.description,
      webhookUrl: parsed.webhookUrl,
      inputSchema: parsed.inputSchema,
      renderAs: parsed.renderAs ?? null,
      enabled: parsed.enabled,
    })
    .where(and(eq(schema.tools.id, id), eq(schema.tools.tenantId, tenant.id)));

  revalidatePath('/dashboard/tools');
}

export async function deleteTool(formData: FormData) {
  const tenant = await requireTenant();
  const id = z.string().uuid().parse(formData.get('id'));

  await db
    .delete(schema.tools)
    .where(and(eq(schema.tools.id, id), eq(schema.tools.tenantId, tenant.id)));

  revalidatePath('/dashboard/tools');
}

export async function rotateWebhookSecret(formData: FormData) {
  const tenant = await requireTenant();
  const id = z.string().uuid().parse(formData.get('id'));

  const webhookSecret = await generateWebhookSecret();
  await db
    .update(schema.tools)
    .set({ webhookSecret })
    .where(and(eq(schema.tools.id, id), eq(schema.tools.tenantId, tenant.id)));

  revalidatePath('/dashboard/tools');
}
