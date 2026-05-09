'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Code, Input } from '@/components/ui';

interface UIMessage {
  role: 'user' | 'assistant';
  parts: Array<
    | { kind: 'text'; text: string }
    | { kind: 'tool'; name: string; status: 'running' | 'done' | 'error' }
    | { kind: 'card'; cardType: string; data: unknown }
  >;
}

export function Playground({ publicToken }: { publicToken: string }) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    setError(null);

    const next = [
      ...messages,
      { role: 'user' as const, parts: [{ kind: 'text' as const, text }] },
      { role: 'assistant' as const, parts: [] as UIMessage['parts'] },
    ];
    setMessages(next);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setStreaming(true);

    try {
      // Build the wire-shape conversation from UI messages (text only).
      const wire = next
        .filter((m) => m.parts.length > 0 || m === next[next.length - 2])
        .filter((m) => m !== next[next.length - 1]) // exclude empty assistant placeholder
        .map((m) => ({
          role: m.role,
          content: m.parts
            .filter((p) => p.kind === 'text')
            .map((p) => (p.kind === 'text' ? p.text : ''))
            .join(''),
        }));

      const res = await fetch('/embed/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicToken}`,
        },
        body: JSON.stringify({ messages: wire }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${txt || res.statusText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let chunk:
            | { type: 'text'; delta: string }
            | { type: 'tool_status'; id: string; name: string; status: 'running' | 'done' | 'error' }
            | { type: 'card'; cardType: string; data: unknown }
            | { type: 'done' }
            | { type: 'error'; error: string };
          try {
            chunk = JSON.parse(line);
          } catch {
            continue;
          }

          setMessages((cur) => {
            const last = cur[cur.length - 1];
            if (!last || last.role !== 'assistant') return cur;
            const newLast: UIMessage = { ...last, parts: [...last.parts] };

            if (chunk.type === 'text') {
              const lastPart = newLast.parts[newLast.parts.length - 1];
              if (lastPart && lastPart.kind === 'text') {
                newLast.parts[newLast.parts.length - 1] = {
                  kind: 'text',
                  text: lastPart.text + chunk.delta,
                };
              } else {
                newLast.parts.push({ kind: 'text', text: chunk.delta });
              }
            } else if (chunk.type === 'tool_status') {
              const existing = newLast.parts.findIndex(
                (p) => p.kind === 'tool' && p.name === chunk.name,
              );
              const part = { kind: 'tool' as const, name: chunk.name, status: chunk.status };
              if (existing >= 0) newLast.parts[existing] = part;
              else newLast.parts.push(part);
            } else if (chunk.type === 'card') {
              newLast.parts.push({ kind: 'card', cardType: chunk.cardType, data: chunk.data });
            } else if (chunk.type === 'error') {
              setError(chunk.error);
            }

            return [...cur.slice(0, -1), newLast];
          });
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 520 }}>
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {messages.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', marginTop: 80 }}>
            Send a message to test your live setup.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '10px 12px',
                borderRadius: 12,
                background: m.role === 'user' ? 'var(--accent)' : 'var(--accent-soft)',
                color: m.role === 'user' ? 'white' : 'var(--fg)',
                fontSize: 14,
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.parts.length === 0 && m.role === 'assistant' && streaming && (
                <span style={{ opacity: 0.6 }}>Thinking…</span>
              )}
              {m.parts.map((p, j) => {
                if (p.kind === 'text') return <span key={j}>{p.text}</span>;
                if (p.kind === 'tool')
                  return (
                    <div key={j} style={{ marginTop: 6, fontSize: 11 }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: 'rgba(0,0,0,0.06)',
                          color: 'var(--muted)',
                        }}
                      >
                        {p.status === 'running' ? '⟳' : p.status === 'error' ? '⚠' : '✓'}{' '}
                        <code>{p.name}</code>
                      </span>
                    </div>
                  );
                if (p.kind === 'card')
                  return (
                    <details
                      key={j}
                      style={{
                        marginTop: 8,
                        background: 'var(--bg)',
                        color: 'var(--fg)',
                        padding: 8,
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                      }}
                    >
                      <summary style={{ cursor: 'pointer', fontSize: 12 }}>
                        Card: <Code>{p.cardType}</Code>
                      </summary>
                      <pre
                        style={{
                          marginTop: 8,
                          fontSize: 11,
                          maxHeight: 240,
                          overflow: 'auto',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {JSON.stringify(p.data, null, 2)}
                      </pre>
                    </details>
                  );
                return null;
              })}
            </div>
          </div>
        ))}
        {error && (
          <div style={{ color: '#b91c1c', fontSize: 12, padding: 8 }}>Error: {error}</div>
        )}
      </div>

      <div
        style={{
          borderTop: '1px solid var(--border)',
          padding: 12,
          display: 'flex',
          gap: 8,
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask anything…"
          disabled={streaming}
        />
        {streaming ? (
          <Button
            variant="danger"
            onClick={() => {
              abortRef.current?.abort();
            }}
          >
            Stop
          </Button>
        ) : (
          <Button onClick={send} disabled={!input.trim()}>
            Send
          </Button>
        )}
      </div>
    </div>
  );
}
