/**
 * Shared fetch-with-retry for provider streaming endpoints.
 *
 * Why: 429s and transient 5xxs are common with shared LLM credentials. A single
 * blip should not kill the user's turn. We retry up to MAX_RETRIES times with
 * jittered exponential backoff, honoring `Retry-After` when the provider gives
 * one. Streaming bodies are NEVER retried mid-stream — we only retry the
 * initial request, before any chunks have been forwarded to the client.
 */

const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8_000;

function pickRetryAfterMs(res: Response, body: string): number | null {
  const header = res.headers.get('retry-after');
  if (header) {
    const secs = Number(header);
    if (Number.isFinite(secs)) return Math.min(secs * 1000, MAX_BACKOFF_MS);
    const dateMs = Date.parse(header);
    if (Number.isFinite(dateMs)) {
      return Math.min(Math.max(0, dateMs - Date.now()), MAX_BACKOFF_MS);
    }
  }
  // Groq inlines "try again in 4.33s" in the JSON body — parse as fallback.
  const m = /try again in ([\d.]+)\s*s/i.exec(body);
  if (m) {
    const secs = Number(m[1]);
    if (Number.isFinite(secs)) return Math.min(secs * 1000, MAX_BACKOFF_MS);
  }
  return null;
}

function backoffMs(attempt: number): number {
  const exp = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  // Full jitter — avoids thundering-herd on shared keys.
  return Math.floor(Math.random() * exp);
}

function isRetriable(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new Error('aborted'));
      return;
    }
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(signal.reason ?? new Error('aborted'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export interface FetchWithRetryResult {
  res: Response;
  /** Pre-read body, ONLY populated when res.ok=false (so callers can include it in error messages). */
  errorBody?: string;
}

/**
 * Performs a streaming fetch with bounded retries on 429/502/503/504. Returns
 * the final Response — when ok=true, the body is untouched and ready to stream.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  signal: AbortSignal,
): Promise<FetchWithRetryResult> {
  let lastBody = '';
  let lastRes: Response | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal.aborted) throw signal.reason ?? new Error('aborted');

    const res = await fetch(url, { ...init, signal });
    if (res.ok) return { res };

    const body = await res.text().catch(() => '');
    lastRes = res;
    lastBody = body;

    if (!isRetriable(res.status) || attempt === MAX_RETRIES) {
      return { res, errorBody: body };
    }

    const retryAfter = pickRetryAfterMs(res, body);
    const wait = retryAfter ?? backoffMs(attempt);
    try {
      await sleep(wait, signal);
    } catch {
      // aborted during backoff — return last response so caller surfaces it.
      return { res, errorBody: body };
    }
  }

  // Unreachable, but TS wants a definite return.
  return { res: lastRes!, errorBody: lastBody };
}
