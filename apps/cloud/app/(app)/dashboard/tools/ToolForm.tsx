'use client';

import { useState, useTransition } from 'react';
import { Button, Field, Input, Textarea } from '@/components/ui';
import { createTool, updateTool } from './actions';

const SAMPLE_SCHEMA = `{
  "type": "object",
  "properties": {
    "city": { "type": "string", "description": "Destination city" },
    "guests": { "type": "number", "description": "Number of guests" }
  },
  "required": ["city", "guests"]
}`;

export function ToolForm({
  initial,
  onDone,
}: {
  initial?: {
    id: string;
    name: string;
    description: string;
    webhookUrl: string;
    inputSchema: Record<string, unknown>;
    renderAs: string | null;
    enabled: boolean;
  };
  onDone?: () => void;
}) {
  const isEdit = !!initial;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      style={{ padding: 16 }}
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          try {
            if (isEdit) {
              fd.set('id', initial.id);
              await updateTool(fd);
            } else {
              await createTool(fd);
            }
            onDone?.();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save');
          }
        })
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}
      >
        <Field label="Name" hint="A valid identifier — what the LLM will call.">
          <Input
            name="name"
            required
            defaultValue={initial?.name ?? ''}
            placeholder="searchListings"
          />
        </Field>
        <Field
          label="Render as"
          hint="Optional. If set, the tool result is rendered as a card of this type. e.g. listingCards, productCards, link."
        >
          <Input
            name="renderAs"
            defaultValue={initial?.renderAs ?? ''}
            placeholder="(text only)"
          />
        </Field>
      </div>
      <Field label="Description" hint="Shown to the LLM. Be specific about when to call it.">
        <Textarea
          name="description"
          required
          defaultValue={initial?.description ?? ''}
          placeholder="Search travel stays by city and number of guests"
        />
      </Field>
      <Field label="Webhook URL" hint="aivoy POSTs here when the LLM calls this tool.">
        <Input
          name="webhookUrl"
          type="url"
          required
          defaultValue={initial?.webhookUrl ?? ''}
          placeholder="https://your-app.com/api/aivoy/searchListings"
        />
      </Field>
      <Field label="Input schema (JSON Schema)" hint="What arguments the LLM should pass.">
        <Textarea
          name="inputSchema"
          required
          rows={10}
          defaultValue={
            initial ? JSON.stringify(initial.inputSchema, null, 2) : SAMPLE_SCHEMA
          }
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
        />
      </Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13 }}>
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={initial?.enabled ?? true}
        />
        <span>Enabled — exposed to the LLM</span>
      </label>

      {error && <p style={{ color: '#b91c1c', fontSize: 12, marginBottom: 12 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add tool'}
        </Button>
        {isEdit && onDone && (
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
