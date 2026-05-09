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
    avatarUrl: string | null;
    theme: Record<string, unknown> | null;
  } | null;
  providers: { id: string; label: string; provider: string; model: string }[];
}

const PRESET_ACCENTS = ['#6d28d9', '#2563eb', '#059669', '#dc2626', '#d97706', '#0f172a'];

export function AssistantForm({ initial, providers }: AssistantFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const themeAccent = (initial?.theme?.['accent'] as string | undefined) ?? '#6d28d9';
  const themeMode = (initial?.theme?.['mode'] as string | undefined) ?? 'auto';
  const themePosition = (initial?.theme?.['position'] as string | undefined) ?? 'bottom-right';

  const [accent, setAccent] = useState(themeAccent);

  return (
    <form
      className="form-grid"
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
      <div className="form-2col">
        <Field label="Assistant name" hint="Shown in the chat header.">
          <Input name="name" required defaultValue={initial?.name ?? 'Aivoy'} />
        </Field>
        <Field label="Active provider" hint="Which LLM credential answers messages.">
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

      <Field label="Avatar URL" hint="Optional. Square image shown in the chat header.">
        <Input
          name="avatarUrl"
          type="url"
          defaultValue={initial?.avatarUrl ?? ''}
          placeholder="https://yourbrand.com/avatar.png"
        />
      </Field>

      <Field label="Greeting" hint="First message shown when the chat opens.">
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

      <h3 style={{ marginTop: 8, marginBottom: 4 }}>Theme</h3>
      <p className="muted text-sm" style={{ marginTop: 0, marginBottom: 8 }}>
        Visual customization for the embedded widget. All fields are optional.
      </p>

      <div className="form-2col">
        <Field label="Accent colour" hint="Used for buttons, chips, and the launcher.">
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              style={{ width: 36, height: 36, border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 2, background: 'var(--bg-elevated)', cursor: 'pointer' }}
              aria-label="Accent colour picker"
            />
            <Input
              name="themeAccent"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              placeholder="#6d28d9"
              pattern="^#[0-9a-fA-F]{6}$"
            />
          </div>
          <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {PRESET_ACCENTS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setAccent(c)}
                aria-label={`Use ${c}`}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: c,
                  border: accent.toLowerCase() === c ? '2px solid var(--fg)' : '1px solid var(--border)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </Field>

        <Field label="Color mode" hint="Match user's OS, or force one.">
          <Select name="themeMode" defaultValue={themeMode}>
            <option value="auto">Auto (follow OS)</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        </Field>
      </div>

      <Field label="Launcher position" hint="Where the floating chat button sits on the page.">
        <Select name="themePosition" defaultValue={themePosition}>
          <option value="bottom-right">Bottom right</option>
          <option value="bottom-left">Bottom left</option>
        </Select>
      </Field>

      {error && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>{error}</p>}
      {saved && <p style={{ color: 'var(--success)', fontSize: 12, marginBottom: 12 }}>Saved ✓</p>}
      {providers.length === 0 && (
        <p style={{ color: 'var(--warning)', fontSize: 12, marginBottom: 12 }}>
          You need at least one provider before this assistant can answer messages.
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}
