import { useEffect, useRef, useState } from 'react';
import { useConcierge } from '../core/useConcierge';
import { useConciergeContext } from '../core/ConciergeProvider';
import { MessageBubble } from './MessageBubble';
import { SuggestedPrompts } from './SuggestedPrompts';
import { Composer } from './Composer';

const AIVOY_HOME = 'https://aivoy.vercel.app/';

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
          <HeaderMenu hasMessages={messages.length > 0} onClear={clear} />
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
        <a
          className="aivoy-panel__brand"
          href={AIVOY_HOME}
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by Aivoy
        </a>
      </div>
    </div>
  );
}

function HeaderMenu({
  hasMessages,
  onClear,
}: {
  hasMessages: boolean;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="aivoy-menu" ref={wrapRef}>
      <button
        type="button"
        className="aivoy-panel__icon-btn"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open && (
        <div className="aivoy-menu__list" role="menu">
          {hasMessages && (
            <button
              type="button"
              role="menuitem"
              className="aivoy-menu__item"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
            >
              <span className="aivoy-menu__icon" aria-hidden>↺</span>
              <span>New chat</span>
            </button>
          )}
          <a
            role="menuitem"
            className="aivoy-menu__item"
            href={AIVOY_HOME}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            <span className="aivoy-menu__icon" aria-hidden>↗</span>
            <span>Visit Aivoy</span>
          </a>
          <a
            role="menuitem"
            className="aivoy-menu__item"
            href={`${AIVOY_HOME}docs`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            <span className="aivoy-menu__icon" aria-hidden>?</span>
            <span>Help &amp; docs</span>
          </a>
          <div className="aivoy-menu__sep" />
          <div className="aivoy-menu__hint">
            Crafted by{' '}
            <a
              href="https://github.com/007aneesh"
              target="_blank"
              rel="noopener noreferrer"
              className="aivoy-menu__author"
            >
              Aneesh
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
