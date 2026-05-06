import { useConciergeContext } from './ConciergeProvider';
import { useStore } from 'zustand';
import type { Message } from './types';

export interface UseConcierge {
  open: boolean;
  isStreaming: boolean;
  messages: Message[];
  error: string | null;
  setOpen: (open: boolean) => void;
  send: (text: string) => void;
  stop: () => void;
  clear: () => void;
}

export function useConcierge(): UseConcierge {
  const { store, send, stop, clear } = useConciergeContext();
  const open = useStore(store, (s) => s.open);
  const isStreaming = useStore(store, (s) => s.isStreaming);
  const messages = useStore(store, (s) => s.messages);
  const error = useStore(store, (s) => s.error);
  const setOpen = useStore(store, (s) => s.setOpen);

  return { open, isStreaming, messages, error, setOpen, send, stop, clear };
}
