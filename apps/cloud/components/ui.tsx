'use client';

import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section style={{ marginBottom: 32 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 12,
          gap: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
          {description && (
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
              {description}
            </p>
          )}
        </div>
        {action}
      </header>
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 10,
          background: 'var(--bg)',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 24,
        gap: 16,
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 28 }}>{title}</h1>
        {description && (
          <p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
};

export function Button({ variant = 'primary', style, ...rest }: ButtonProps) {
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'var(--accent)',
      color: 'white',
      border: '1px solid var(--accent)',
    },
    secondary: {
      background: 'var(--bg)',
      color: 'inherit',
      border: '1px solid var(--border)',
    },
    danger: {
      background: 'transparent',
      color: '#dc2626',
      border: '1px solid #dc2626',
    },
    ghost: {
      background: 'transparent',
      color: 'inherit',
      border: 'none',
    },
  };
  return (
    <button
      {...rest}
      style={{
        padding: '8px 14px',
        borderRadius: 6,
        cursor: 'pointer',
        font: 'inherit',
        fontSize: 13,
        fontWeight: 500,
        ...styles[variant],
        ...style,
      }}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        padding: '8px 10px',
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        color: 'inherit',
        font: 'inherit',
        fontSize: 13,
        ...props.style,
      }}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: '100%',
        padding: '8px 10px',
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        color: 'inherit',
        font: 'inherit',
        fontSize: 13,
        fontFamily: 'inherit',
        resize: 'vertical',
        minHeight: 60,
        ...props.style,
      }}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: '100%',
        padding: '8px 10px',
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        color: 'inherit',
        font: 'inherit',
        fontSize: 13,
        ...props.style,
      }}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 500 }}>
        {label}
      </span>
      {children}
      {hint && (
        <span
          style={{
            display: 'block',
            fontSize: 11,
            color: 'var(--muted)',
            marginTop: 4,
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: '24px 16px',
        color: 'var(--muted)',
        textAlign: 'center',
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

export function Code({ children, block }: { children: string; block?: boolean }) {
  return (
    <code
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 12,
        background: 'var(--accent-soft)',
        color: 'var(--accent)',
        padding: block ? 12 : '2px 6px',
        borderRadius: block ? 8 : 4,
        display: block ? 'block' : 'inline',
        whiteSpace: block ? 'pre-wrap' : 'nowrap',
        wordBreak: block ? 'break-all' : 'normal',
      }}
    >
      {children}
    </code>
  );
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          // ignore — clipboard may be blocked in some browsers / iframes
        }
      }}
    >
      {copied ? '✓ Copied' : label}
    </Button>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'bad' }) {
  const tones = {
    neutral: { bg: 'var(--accent-soft)', fg: 'var(--accent)' },
    good: { bg: '#d1fae5', fg: '#047857' },
    bad: { bg: '#fee2e2', fg: '#b91c1c' },
  };
  const t = tones[tone];
  return (
    <span
      style={{
        background: t.bg,
        color: t.fg,
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 999,
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}
