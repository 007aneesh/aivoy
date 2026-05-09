import type { Message, PersistenceConfig } from './types';

const SCHEMA_VERSION = 1;
const DEFAULT_KEY = 'aivoy:thread';

interface Stored {
  v: number;
  messages: Message[];
}

function pickStorage(strategy: PersistenceConfig['strategy']): Storage | null {
  if (typeof window === 'undefined') return null;
  if (strategy === 'session') return window.sessionStorage;
  if (strategy === 'local') return window.localStorage;
  return null;
}

export async function loadThread(cfg: PersistenceConfig): Promise<Message[]> {
  if (cfg.strategy === 'none') return [];

  if (cfg.strategy === 'remote' && cfg.load) {
    const m = await cfg.load();
    return Array.isArray(m) ? m : [];
  }

  const storage = pickStorage(cfg.strategy);
  if (storage) {
    const key = cfg.key ?? DEFAULT_KEY;
    try {
      const raw = storage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Stored;
      if (parsed?.v !== SCHEMA_VERSION) return [];
      return Array.isArray(parsed.messages) ? parsed.messages : [];
    } catch {
      return [];
    }
  }

  return [];
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveThread(cfg: PersistenceConfig, messages: Message[]): void {
  if (cfg.strategy === 'none') return;

  if (cfg.strategy === 'remote' && cfg.save) {
    void cfg.save(messages);
    return;
  }

  const storage = pickStorage(cfg.strategy);
  if (storage) {
    const key = cfg.key ?? DEFAULT_KEY;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const payload: Stored = { v: SCHEMA_VERSION, messages };
        storage.setItem(key, JSON.stringify(payload));
      } catch {
        // ignore quota / private mode failures
      }
    }, 250);
  }
}

export function clearThread(cfg: PersistenceConfig): void {
  const storage = pickStorage(cfg.strategy);
  if (storage) {
    try {
      storage.removeItem(cfg.key ?? DEFAULT_KEY);
    } catch {
      // ignore
    }
  }
  if (cfg.strategy === 'remote' && cfg.save) {
    void cfg.save([]);
  }
}
