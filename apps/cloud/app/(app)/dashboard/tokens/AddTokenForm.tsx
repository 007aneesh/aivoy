'use client';

import { useState, useTransition } from 'react';
import { Button, Field, Input, Textarea } from '@/components/ui';
import { createToken } from './actions';

export function AddTokenForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      style={{ padding: 16 }}
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          try {
            await createToken(fd);
            (document.getElementById('add-token-form') as HTMLFormElement | null)?.reset();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to create');
          }
        })
      }
      id="add-token-form"
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Label" hint="Internal name. Not exposed to widget users.">
          <Input name="label" required placeholder="Production" />
        </Field>
        <Field
          label="Monthly message cap"
          hint="Empty for unlimited. Hard limit before the proxy starts returning 429."
        >
          <Input name="monthlyCap" type="number" min="1" placeholder="(unlimited)" />
        </Field>
      </div>
      <Field
        label="Allowed origins"
        hint="One per line, or comma-separated. Browser requests with a different Origin header are rejected."
      >
        <Textarea
          name="allowedOrigins"
          required
          rows={3}
          placeholder={'https://your-app.com\nhttp://localhost:5173'}
        />
      </Field>

      {error && <p style={{ color: '#b91c1c', fontSize: 12, marginBottom: 12 }}>{error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Generating…' : 'Generate token'}
      </Button>
    </form>
  );
}
