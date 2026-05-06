import { useEffect, useRef } from 'react';
import { useConcierge } from '../core/useConcierge';
import { useConciergeContext } from '../core/ConciergeProvider';
import { MessageBubble } from './MessageBubble';
import { SuggestedPrompts } from './SuggestedPrompts';
import { Composer } from './Composer';

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const { assistant, theme, context } = useConciergeContext();
  const { messages, isStreaming, send, stop, clear } = useConcierge();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const greeting =
    typeof assistant.greeting === 'function'
      ? assistant.greeting(context)
      : (assistant.greeting ?? `Hi! I'm ${assistant.name}. How can I help today?`);

  const position = theme.position ?? 'bottom-right';
  const isEmpty = messages.length === 0;

  return (
    <div className={`aivoy-panel aivoy-panel--${position}`} role="dialog" aria-label={assistant.name}>
      <header className="aivoy-panel__header">
        <div className="aivoy-panel__identity">
          {assistant.avatarUrl && (
            <img src={assistant.avatarUrl} alt="" className="aivoy-panel__avatar" />
          )}
          <div className="aivoy-panel__name">{assistant.name}</div>
        </div>
        <div className="aivoy-panel__actions">
          {messages.length > 0 && (
            <button
              type="button"
              className="aivoy-panel__icon-btn"
              onClick={clear}
              aria-label="Clear conversation"
              title="Clear conversation"
            >
              ↺
            </button>
          )}
          <button
            type="button"
            className="aivoy-panel__icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="aivoy-panel__body" ref={scrollRef}>
        {isEmpty ? (
          <div className="aivoy-panel__empty">
            {assistant.avatarUrl && (
              <div className="aivoy-panel__empty-avatar-wrap">
                <img
                  src={assistant.avatarUrl}
                  alt=""
                  className="aivoy-panel__empty-avatar"
                />
              </div>
            )}
            <div className="aivoy-panel__greeting">{greeting}</div>
            <SuggestedPrompts
              prompts={assistant.suggestedPrompts ?? []}
              onPick={send}
            />
          </div>
        ) : (
          <div className="aivoy-panel__messages">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>

      <div className="aivoy-panel__footer">
        <Composer
          placeholder={`Ask ${assistant.name} anything`}
          isStreaming={isStreaming}
          onSend={send}
          onStop={stop}
        />
      </div>
    </div>
  );
}
