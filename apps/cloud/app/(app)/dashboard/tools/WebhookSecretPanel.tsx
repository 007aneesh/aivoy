'use client';

import { useState, useTransition } from 'react';
import { Button, Code, CopyButton } from '@/components/ui';
import { rotateWebhookSigningSecret } from '@/lib/tenant-actions';

/**
 * Tenant-level webhook signing secret. Used to sign EVERY webhook aivoy posts
 * to this tenant's tools. One env var on the consumer side (AIVOY_WEBHOOK_SECRET);
 * adding a new tool requires zero new env vars.
 *
 * Server passes the current value in. Rotating it returns the new value via
 * the server action; we display it transiently so the user can copy.
 */
export function WebhookSecretPanel({ initial }: { initial: string }) {
  const [secret, setSecret] = useState(initial);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const masked = secret.slice(0, 8) + '…' + secret.slice(-4);

  const rotate = () => {
    if (
      !confirm(
        'Rotate the webhook signing secret?\n\nIn-flight requests with the old secret ' +
          'will fail until you update AIVOY_WEBHOOK_SECRET on every consumer server.',
      )
    ) {
      return;
    }
    startTransition(async () => {
      setError(null);
      try {
        const res = await rotateWebhookSigningSecret();
        setSecret(res.secret);
        setRevealed(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Rotation failed');
      }
    });
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
        aivoy signs every tool webhook with this single secret using HMAC-SHA256.
        Set <code>AIVOY_WEBHOOK_SECRET</code> on your consumer server (Casalux,
        etc.). Rotating invalidates the old secret immediately.
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Code>{revealed ? secret : masked}</Code>
        <Button variant="secondary" onClick={() => setRevealed((v) => !v)}>
          {revealed ? 'Hide' : 'Reveal'}
        </Button>
        {revealed && <CopyButton text={secret} />}
        <Button variant="ghost" onClick={rotate} disabled={pending}>
          {pending ? 'Rotating…' : 'Rotate'}
        </Button>
      </div>

      <details style={{ fontSize: 12, color: 'var(--muted)' }}>
        <summary style={{ cursor: 'pointer' }}>How to verify on your server</summary>
        <div style={{ marginTop: 8, lineHeight: 1.6 }}>
          Header: <Code>{'X-Aivoy-Signature: t={ts},v1={hex}'}</Code>
          <br />
          Sign string: <Code>{'`${ts}.${rawBody}`'}</Code>
          <br />
          Algorithm: <strong>HMAC-SHA256</strong>
          <br />
          Replay window: ±5 minutes recommended on your verifier
        </div>
      </details>

      {error && <p style={{ color: '#b91c1c', fontSize: 12, margin: 0 }}>{error}</p>}
    </div>
  );
}
