/**
 * One-line JSON logger.
 *
 * Writes a single newline-terminated object to stdout/stderr — Vercel,
 * CloudWatch, Datadog, Loki, and most aggregators all parse this shape
 * without configuration. Structured fields beat string interpolation
 * because they're filterable downstream (`level=error tenant=…`).
 *
 * Avoid plain `console.log` from chat-path code: unstructured strings
 * get lost in production logs.
 */

type Level = 'info' | 'warn' | 'error';

export interface LogFields {
  [key: string]: unknown;
}

function emit(level: Level, message: string, fields?: LogFields) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...fields,
  });
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const log = {
  info: (msg: string, fields?: LogFields) => emit('info', msg, fields),
  warn: (msg: string, fields?: LogFields) => emit('warn', msg, fields),
  error: (msg: string, fields?: LogFields) => emit('error', msg, fields),
};

/** Generate a short request id. Not crypto-secure — visibility / tracing only. */
export function newRequestId(): string {
  return (
    'req_' +
    Date.now().toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 8)
  );
}
