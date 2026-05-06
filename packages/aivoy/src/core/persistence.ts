import type { Message, PersistenceConfig } from './types';

const SCHEMA_VERSION = 1;

interface Stored {
  v: number;
  messages: Message[];
}

export async function loadThread(cfg: PersistenceConfig): Promise<Message[]> {
  if (cfg.strategy === 'none') return [];

  if (cfg.strategy === 'remote' && cfg.load) {
    const m = await cfg.load();
    return Array.isArray(m) ? m : [];
  }

  if (cfg.strategy === 'local' && typeof window !== 'undefined') {
    const key = cfg.key ?? 'aivoy:thread';
    try {
      const raw = window.localStorage.getItem(key);
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

  if (cfg.strategy === 'local' && typeof window !== 'undefined') {
    const key = cfg.key ?? 'aivoy:thread';
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const payload: Stored = { v: SCHEMA_VERSION, messages };
        window.localStorage.setItem(key, JSON.stringify(payload));
      } catch {
        // ignore quota / private mode failures
      }
    }, 250);
  }
}

export function clearThread(cfg: PersistenceConfig): void {
  if (cfg.strategy === 'local' && typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(cfg.key ?? 'aivoy:thread');
    } catch {
      // ignore
    }
  }
  if (cfg.strategy === 'remote' && cfg.save) {
    void cfg.save([]);
  }
}
