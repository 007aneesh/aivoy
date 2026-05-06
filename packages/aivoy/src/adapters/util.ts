import type { Message } from '../core/types';

/** Flatten a Message into plain text — used by adapters that don't natively understand cards. */
export function messageToText(m: Message): string {
  return m.parts
    .map((p) => {
      if (p.kind === 'text') return p.text;
      return `[card:${p.card.type} ${JSON.stringify(p.card.data)}]`;
    })
    .join('\n');
}

export function zodToJsonSchema(schema: unknown): Record<string, unknown> {
  // Minimal converter — handles the common shapes we expect on tool inputs.
  // For richer support, a host can wrap their tools with a fuller converter.
  const z = schema as { _def?: { typeName?: string; shape?: () => Record<string, unknown> } };
  if (!z?._def) return { type: 'object' };

  const def = z._def;
  switch (def.typeName) {
    case 'ZodObject': {
      const shape = def.shape?.() ?? {};
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, val] of Object.entries(shape)) {
        const child = zodToJsonSchema(val);
        properties[key] = child;
        const inner = (val as { _def?: { typeName?: string } })._def;
        if (inner?.typeName !== 'ZodOptional' && inner?.typeName !== 'ZodDefault') {
          required.push(key);
        }
      }
      return { type: 'object', properties, required };
    }
    case 'ZodString':
      return { type: 'string' };
    case 'ZodNumber':
      return { type: 'number' };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodArray': {
      const inner = (def as unknown as { type: unknown }).type;
      return { type: 'array', items: zodToJsonSchema(inner) };
    }
    case 'ZodOptional':
    case 'ZodDefault':
    case 'ZodNullable': {
      const inner = (def as unknown as { innerType: unknown }).innerType;
      return zodToJsonSchema(inner);
    }
    case 'ZodEnum': {
      const values = (def as unknown as { values: string[] }).values;
      return { type: 'string', enum: values };
    }
    case 'ZodLiteral': {
      const value = (def as unknown as { value: unknown }).value;
      return { const: value };
    }
    case 'ZodUnion': {
      const options = (def as unknown as { options: unknown[] }).options;
      return { anyOf: options.map(zodToJsonSchema) };
    }
    default:
      return {};
  }
}
