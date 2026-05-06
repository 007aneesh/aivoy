import { create } from 'zustand';
import type { Message } from './types';

export interface ConciergeState {
  open: boolean;
  messages: Message[];
  isStreaming: boolean;
  error: string | null;

  setOpen: (open: boolean) => void;
  setMessages: (messages: Message[]) => void;
  appendMessage: (message: Message) => void;
  upsertAssistant: (message: Message) => void;
  finalize: (id: string) => void;
  setStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export function createConciergeStore() {
  return create<ConciergeState>((set) => ({
    open: false,
    messages: [],
    isStreaming: false,
    error: null,

    setOpen: (open) => set({ open }),
    setMessages: (messages) => set({ messages }),
    appendMessage: (message) =>
      set((s) => ({ messages: [...s.messages, message] })),
    upsertAssistant: (message) =>
      set((s) => {
        const idx = s.messages.findIndex((m) => m.id === message.id);
        if (idx === -1) return { messages: [...s.messages, message] };
        const next = s.messages.slice();
        next[idx] = message;
        return { messages: next };
      }),
    finalize: (id) =>
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === id ? { ...m, pending: false } : m,
        ),
      })),
    setStreaming: (isStreaming) => set({ isStreaming }),
    setError: (error) => set({ error }),
    reset: () => set({ messages: [], error: null, isStreaming: false }),
  }));
}

export type ConciergeStore = ReturnType<typeof createConciergeStore>;
