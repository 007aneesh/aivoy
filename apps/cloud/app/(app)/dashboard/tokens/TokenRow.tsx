'use client';

import { useState } from 'react';
import { Badge, Button, Code, CopyButton } from '@/components/ui';
import { revokeToken, deleteToken } from './actions';

export interface TokenViewModel {
  id: string;
  publicToken: string;
  label: string;
  allowedOrigins: string[];
  monthlyMessageCap: number | null;
  revoked: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://aivoy.example';

export function TokenRow({ token }: { token: TokenViewModel }) {
  const [showSnippet, setShowSnippet] = useState(false);
  const [showFull, setShowFull] = useState(false);

  const display = showFull
    ? token.publicToken
    : token.publicToken.slice(0, 8) + '…' + token.publicToken.slice(-4);

  const snippet = `<script
  src="${APP_URL}/embed/loader.js"
  data-token="${token.publicToken}"
></script>`;

  return (
    <div
      style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
          >
            <strong>{token.label}</strong>
            {token.revoked ? (
              <Badge tone="bad">revoked</Badge>
            ) : (
              <Badge tone="good">active</Badge>
            )}
            {token.monthlyMessageCap != null && (
              <Badge>{token.monthlyMessageCap.toLocaleString()} msg/mo cap</Badge>
            )}
          </div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Code>{display}</Code>
            <Button variant="secondary" onClick={() => setShowFull((v) => !v)}>
              {showFull ? 'Hide' : 'Reveal'}
            </Button>
            {showFull && <CopyButton text={token.publicToken} />}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
            Origins:{' '}
            {token.allowedOrigins.length
              ? token.allowedOrigins.map((o) => <Code key={o}>{o}</Code>)
              : 'none — server-to-server only'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            Last used: {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : 'never'}
            {' • '}created {new Date(token.createdAt).toLocaleString()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {!token.revoked && (
            <form action={revokeToken}>
              <input type="hidden" name="id" value={token.id} />
              <Button variant="secondary">Revoke</Button>
            </form>
          )}
          <form
            action={deleteToken}
            onSubmit={(e) => {
              if (!confirm('Delete this token? Usage history is preserved.')) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={token.id} />
            <Button variant="danger">Delete</Button>
          </form>
        </div>
      </div>

      <div style={{ fontSize: 12 }}>
        <Button variant="ghost" onClick={() => setShowSnippet((v) => !v)} style={{ padding: 0 }}>
          {showSnippet ? '− Hide embed snippet' : '+ Show embed snippet'}
        </Button>
        {showSnippet && (
          <div style={{ marginTop: 8 }}>
            <Code block>{snippet}</Code>
            <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
              <CopyButton text={snippet} label="Copy snippet" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
