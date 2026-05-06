'use client';

import { useState } from 'react';
import { Badge, Button } from '@/components/ui';
import { ToolForm } from './ToolForm';
import { deleteTool } from './actions';

export interface ToolViewModel {
  id: string;
  name: string;
  description: string;
  webhookUrl: string;
  inputSchema: Record<string, unknown>;
  renderAs: string | null;
  enabled: boolean;
}

export function ToolRow({ tool }: { tool: ToolViewModel }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div style={{ borderBottom: '1px solid var(--border)' }}>
        <ToolForm initial={tool} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
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
          <code style={{ fontSize: 13, fontWeight: 600 }}>{tool.name}</code>
          {tool.enabled ? (
            <Badge tone="good">enabled</Badge>
          ) : (
            <Badge tone="bad">disabled</Badge>
          )}
          {tool.renderAs && <Badge>renderAs: {tool.renderAs}</Badge>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
          {tool.description}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--muted)',
            marginTop: 6,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          POST {tool.webhookUrl}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <form
          action={deleteTool}
          onSubmit={(e) => {
            if (!confirm('Delete this tool? This cannot be undone.')) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={tool.id} />
          <Button variant="danger">Delete</Button>
        </form>
      </div>
    </div>
  );
}
