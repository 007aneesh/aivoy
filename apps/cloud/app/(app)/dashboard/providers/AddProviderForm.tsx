'use client';

import { useState, useTransition } from 'react';
import { Button, Field, Input, Select } from '@/components/ui';
import { createProvider } from './actions';

const DEFAULTS: Record<string, { model: string; baseHint: string }> = {
  openai: { model: 'gpt-4o-mini', baseHint: 'https://api.openai.com/v1' },
  anthropic: { model: 'claude-sonnet-4-6', baseHint: 'https://api.anthropic.com/v1' },
  gemini: { model: 'gemini-1.5-flash', baseHint: 'https://generativelanguage.googleapis.com/v1beta' },
  grok: { model: 'grok-3-mini', baseHint: 'https://api.x.ai/v1' },
  groq: { model: 'llama-3.3-70b-versatile', baseHint: 'https://api.groq.com/openai/v1' },
};

export function AddProviderForm() {
  const [provider, setProvider] = useState<keyof typeof DEFAULTS>('openai');
  const [model, setModel] = useState(DEFAULTS.openai!.model);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      style={{ padding: 16 }}
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          try {
            await createProvider(fd);
            (document.getElementById('add-provider-form') as HTMLFormElement | null)?.reset();
            setProvider('openai');
            setModel(DEFAULTS.openai!.model);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save');
          }
        })
      }
      id="add-provider-form"
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}
      >
        <Field label="Provider">
          <Select
            name="provider"
            value={provider}
            onChange={(e) => {
              const p = e.target.value as keyof typeof DEFAULTS;
              setProvider(p);
              setModel(DEFAULTS[p]!.model);
            }}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
            <option value="grok">Grok (xAI)</option>
            <option value="groq">Groq</option>
          </Select>
        </Field>
        <Field label="Label" hint="Shown in the dashboard. e.g. 'Production'.">
          <Input name="label" required placeholder="Production" />
        </Field>
      </div>
      <Field label="API key" hint="Stored encrypted at rest. We never re-display it.">
        <Input name="apiKey" required type="password" placeholder="sk-…" autoComplete="off" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Model">
          <Input
            name="model"
            required
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
        </Field>
        <Field
          label="Base URL"
          hint={`Optional. Defaults to ${DEFAULTS[provider]!.baseHint}.`}
        >
          <Input name="baseUrl" placeholder="(default)" />
        </Field>
      </div>

      {error && (
        <p style={{ color: '#b91c1c', fontSize: 12, marginBottom: 12 }}>{error}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Add provider'}
      </Button>
    </form>
  );
}
