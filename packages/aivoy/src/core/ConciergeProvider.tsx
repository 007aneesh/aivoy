import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import type {
  AssistantConfig,
  ChatAdapter,
  ConciergeEvent,
  Message,
  PersistenceConfig,
  ThemeConfig,
  Tool,
} from './types';
import { ToolRegistry } from './toolRegistry';
import { runTurn } from './engine';
import { createConciergeStore, type ConciergeStore } from './store';
import { loadThread, saveThread, clearThread } from './persistence';

interface ProviderValue {
  store: ConciergeStore;
  send: (text: string) => void;
  stop: () => void;
  clear: () => void;
  assistant: AssistantConfig;
  theme: ThemeConfig;
  context: Record<string, unknown>;
  cardComponents: Record<string, React.ComponentType<{ data: unknown }>>;
}

const Ctx = createContext<ProviderValue | null>(null);

export interface ConciergeProviderProps {
  adapter: ChatAdapter;
  assistant: AssistantConfig;
  context?: Record<string, unknown>;
  tools?: Tool<any, any>[];
  theme?: ThemeConfig;
  persistence?: PersistenceConfig;
  cards?: Record<string, React.ComponentType<{ data: unknown }>>;
  onEvent?: (event: ConciergeEvent) => void;
  children: ReactNode;
}

export function ConciergeProvider(props: ConciergeProviderProps) {
  const {
    adapter,
    assistant,
    context = {},
    tools = [],
    theme = {},
    persistence = { strategy: 'local' },
    cards = {},
    onEvent,
    children,
  } = props;

  const store = useMemo(() => createConciergeStore(), []);
  const registry = useMemo(() => new ToolRegistry(tools), [tools]);
  const abortRef = useRef<AbortController | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Hydrate from persistence on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadThread(persistence);
      if (!cancelled && stored.length > 0) {
        store.getState().setMessages(stored);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every messages change.
  useEffect(() => {
    return store.subscribe((state, prev) => {
      if (state.messages !== prev.messages) {
        saveThread(persistence, state.messages);
      }
    });
  }, [store, persistence]);

  const emit = (event: ConciergeEvent) => {
    onEventRef.current?.(event);
  };

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (store.getState().isStreaming) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: Message = {
      id: `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      parts: [{ kind: 'text', text: trimmed }],
      createdAt: Date.now(),
    };

    store.getState().appendMessage(userMsg);
    store.getState().setStreaming(true);
    store.getState().setError(null);
    emit({ type: 'message_sent', text: trimmed });

    const history = store.getState().messages;

    void runTurn(
      history,
      { adapter, registry, context, assistant, emit },
      {
        upsertAssistant: (m) => store.getState().upsertAssistant(m),
        finalize: (id) => store.getState().finalize(id),
      },
      controller.signal,
    ).finally(() => {
      store.getState().setStreaming(false);
    });
  };

  const stop = () => {
    abortRef.current?.abort();
    store.getState().setStreaming(false);
  };

  const clear = () => {
    abortRef.current?.abort();
    store.getState().reset();
    clearThread(persistence);
  };

  const value: ProviderValue = {
    store,
    send,
    stop,
    clear,
    assistant,
    theme,
    context,
    cardComponents: cards,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConciergeContext(): ProviderValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useConcierge must be used inside <ConciergeProvider>');
  return v;
}
