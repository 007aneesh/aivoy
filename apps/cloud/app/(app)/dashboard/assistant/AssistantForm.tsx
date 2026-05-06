'use client';

import { useState, useTransition } from 'react';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import { saveAssistant } from './actions';

export interface AssistantFormProps {
  initial: {
    name: string;
    greeting: string | null;
    systemPrompt: string | null;
    suggestedPrompts: string[];
    providerCredentialId: string | null;
  } | null;
  providers: { id: string; label: string; provider: string; model: string }[];
}

export function AssistantForm({ initial, providers }: AssistantFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      style={{ padding: 16 }}
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          setSaved(false);
          try {
            await saveAssistant(fd);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save');
          }
        })
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Assistant name" hint="What users see at the top of the panel.">
          <Input name="name" required defaultValue={initial?.name ?? 'Assistant'} />
        </Field>
        <Field label="Active provider" hint="Which LLM credential to route through.">
          <Select
            name="providerCredentialId"
            defaultValue={initial?.providerCredentialId ?? ''}
            disabled={providers.length === 0}
          >
            <option value="">— select —</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} ({p.provider}/{p.model})
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Greeting" hint="Shown in the empty-state panel before the first message.">
        <Textarea
          name="greeting"
          defaultValue={initial?.greeting ?? ''}
          placeholder="Hi! How can I help you today?"
        />
      </Field>

      <Field
        label="Suggested prompts"
        hint="One per line. Up to 8. Shown as quick-tap chips in the empty state."
      >
        <Textarea
          name="suggestedPrompts"
          defaultValue={(initial?.suggestedPrompts ?? []).join('\n')}
          rows={4}
          placeholder={'Show me popular options\nWhat can you do?'}
        />
      </Field>

      <Field
        label="System prompt (optional)"
        hint="Appended to the auto-generated identity prompt. Use this to set tone, persona, or domain rules."
      >
        <Textarea
          name="systemPrompt"
          rows={5}
          defaultValue={initial?.systemPrompt ?? ''}
        />
      </Field>

      {error && <p style={{ color: '#b91c1c', fontSize: 12, marginBottom: 12 }}>{error}</p>}
      {saved && <p style={{ color: '#047857', fontSize: 12, marginBottom: 12 }}>Saved ✓</p>}
      {providers.length === 0 && (
        <p style={{ color: '#92400e', fontSize: 12, marginBottom: 12 }}>
          You need at least one provider before this assistant can answer messages.
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}
